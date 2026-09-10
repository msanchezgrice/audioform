import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { platformDatabase } from "./database";
import { createProject, createProjectApiKey } from "./projects";
import { authenticateProjectKey, encryptPlatformData } from "./auth";
import { createHandoff, submitRespondentHandoff, deleteHandoff } from "./handoffs";
import { collectWebhookDeliveries, configureWebhook, deliverWebhook, disableWebhook, dispatchWebhookBatch, getWebhook } from "./webhooks";

const databaseUrl = process.env.TALKFORM_WEBHOOK_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;
integration("completion outbox deduplicates, fences concurrent workers, retries, cancels and keeps answers private", async () => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.TALKFORM_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 71).toString("base64");
  const sql = platformDatabase();
  const owner = `webhook_test_${randomUUID()}`;
  const project = await createProject(owner, { name: "Webhook test", environment: "test" });
  const key = await createProjectApiKey(owner, project.id, { name: "Test" });
  const principal = await authenticateProjectKey(new Request("https://www.talkform.ai", { headers: { authorization: `Bearer ${key.secret}` } }), "handoffs:write");
  const config = { id: "webhook-form", title: "Test", fields: [{ id: "answer", label: "Answer", type: "text", required: true, promptTitle: "Answer", promptDetail: "Please answer" }] };
  const complete = async () => {
    const h = await createHandoff(principal, { config, idempotencyKey: randomUUID(), baseUrl: "https://www.talkform.ai" });
    const token = new URL(h.respondentUrl).hash.slice(7);
    await submitRespondentHandoff(h.id, token, { values: { answer: "private reviewed answer" }, mode: "text" });
    await submitRespondentHandoff(h.id, token, { values: { answer: "private reviewed answer" }, mode: "text" });
    return h;
  };
  try {
    await complete();
    const hookId = randomUUID();
    const secret = "tfwh_test_secret";
    const cipher = encryptPlatformData(secret, `talkform:webhook:${hookId}:secret:v1`);
    await sql`insert into tf_webhooks(id,project_id,url,secret_ciphertext) values (${hookId},${project.id},'https://example.com/hook',${cipher})`;
    const first = await complete();
    await Promise.all([collectWebhookDeliveries(), collectWebhookDeliveries()]);
    const state = await getWebhook(project.id);
    assert.equal(state.deliveries.length, 1, "Only future completions are queued, exactly once");
    assert.equal(JSON.stringify(state).includes(secret), false);
    const id = state.deliveries[0].id;
    let attempts = 0;
    const failed = await deliverWebhook(id, async (_url, body, deliveredSecret, eventId) => {
      attempts++;
      assert.equal(deliveredSecret, secret);
      const event = JSON.parse(body);
      assert.equal(event.id, eventId);
      assert.equal(event.data.handoffId, first.id);
      assert.equal(body.includes("private reviewed answer"), false);
      assert.equal(body.includes(key.secret), false);
      return 503;
    });
    assert.equal(failed.status, "retry");
    await deliverWebhook(id, async () => { attempts++; return 200; });
    assert.equal(attempts, 1, "Backoff prevents early delivery");
    await sql`update tf_webhook_deliveries set available_at=now() where id=${id}`;
    const concurrent = await Promise.all([deliverWebhook(id, async () => { attempts++; return 204; }), deliverWebhook(id, async () => { attempts++; return 204; })]);
    assert.equal(concurrent.filter((result) => result.claimed).length, 1);
    assert.equal(attempts, 2);
    assert.equal((await getWebhook(project.id)).deliveries[0].status, "delivered");

    const rotating = await complete();
    const isolated = await complete();
    await collectWebhookDeliveries();
    const replacement = await configureWebhook(project.id, "https://8.8.8.8/replacement");
    assert.notEqual(replacement.secret, secret);
    const posted: string[] = [];
    await dispatchWebhookBatch(async (_url, body) => { posted.push(JSON.parse(body).data.handoffId); return 204; }, { handoffId: rotating.id });
    assert.deepEqual(posted, [rotating.id], "Replacement preserves pending completions and a respondent cannot drain other handoffs");
    await dispatchWebhookBatch(async (_url, body) => { posted.push(JSON.parse(body).data.handoffId); return 204; });
    assert.deepEqual(posted, [rotating.id, isolated.id], "The cron recovers remaining pending events without replaying delivered history");

    const second = await complete();
    await collectWebhookDeliveries();
    await deleteHandoff(principal, second.id);
    await dispatchWebhookBatch(async () => { assert.fail("Deleted results must not dispatch"); });
    assert.equal((await getWebhook(project.id)).deliveries.find((d) => d.handoffId === second.id)?.status, "cancelled");

    const stopped = await complete();
    await collectWebhookDeliveries();
    const stoppedDelivery = (await getWebhook(project.id)).deliveries.find((delivery) => delivery.handoffId === stopped.id)!;
    const interrupted = await deliverWebhook(stoppedDelivery.id, async () => {
      await disableWebhook(project.id);
      return 204;
    });
    assert.equal(interrupted.status, "superseded", "An in-flight response cannot overwrite a disabled subscription or claim durable delivery");
    assert.equal((await getWebhook(project.id)).deliveries.find((delivery) => delivery.id === stoppedDelivery.id)?.status, "cancelled");
    assert.equal((await getWebhook(project.id)).webhook, null);
    await dispatchWebhookBatch(async () => { assert.fail("Disabled endpoint must not dispatch"); });
    assert.equal((await getWebhook(randomUUID())).deliveries.length, 0, "Other projects cannot see deliveries");
  } finally {
    await sql`delete from tf_projects where id=${project.id}`;
    await sql.end();
    globalThis.talkformPlatformSql = undefined;
  }
});
