import assert from "node:assert/strict";
import test from "node:test";
import { authenticateProjectKey } from "./auth";
import { createHandoff, getHandoffResult, getRespondentHandoff, submitRespondentHandoff } from "./handoffs";
import { platformDatabase } from "./database";
import { createProject, createProjectApiKey, getProjectDashboard, revokeProjectApiKey } from "./projects";
import { getOperatorUsage } from "./operator";

const databaseUrl = process.env.TALKFORM_PLATFORM_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;

integration("database enforces tenant, concurrent project/key caps, API-key auth, and idempotent handoffs", async () => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.TALKFORM_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
  const owner = `test_owner_${Date.now()}_${Math.random()}`;
  const stranger = `test_stranger_${Date.now()}_${Math.random()}`;
  const attempts = await Promise.allSettled(Array.from({ length: 6 }, (_, index) => createProject(owner, { name: `Project ${index}`, environment: "test" })));
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 5);
  const project = attempts.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createProject>>> => result.status === "fulfilled")!.value;
  await assert.rejects(() => getProjectDashboard(stranger, project.id), /Project not found/);

  const keys = await Promise.all(Array.from({ length: 5 }, (_, index) => createProjectApiKey(owner, project.id, { name: `Key ${index}` })));
  await assert.rejects(() => createProjectApiKey(owner, project.id, { name: "Sixth" }), /maximum number/);
  for (const key of keys) {
    const verified = await authenticateProjectKey(new Request("https://talkform.test/api/v1/handoffs", { headers: { authorization: `Bearer ${key.secret}` } }), "handoffs:write");
    assert.equal(verified.projectId, project.id);
  }
  await revokeProjectApiKey(owner, project.id, keys[4].id);
  await assert.rejects(() => authenticateProjectKey(new Request("https://talkform.test/api/v1/handoffs", { headers: { authorization: `Bearer ${keys[4].secret}` } }), "handoffs:write"), /Invalid API key/);
  const request = new Request("https://talkform.test/api/v1/handoffs", { headers: { authorization: `Bearer ${keys[0].secret}` } });
  const authenticated = await authenticateProjectKey(request, "handoffs:write");
  assert.equal(authenticated.projectId, project.id);

  const config = { id: "test-form", title: "Test", fields: [{ id: "answer", label: "Answer", type: "text" as const, required: true, promptTitle: "Answer", promptDetail: "Please answer" }] };
  const restContext = { surface: "rest" as const, client: { name: "@talkform/node", version: "1.2.3", selfReported: true as const } };
  const created = await createHandoff(authenticated, { config, idempotencyKey: "db-test-idempotency", baseUrl: "https://talkform.test" }, restContext);
  const replay = await createHandoff(authenticated, { config, idempotencyKey: "db-test-idempotency", baseUrl: "https://talkform.test" }, { surface: "mcp" });
  assert.equal(replay.respondentUrl, created.respondentUrl);
  await assert.rejects(() => createHandoff(authenticated, { config: { ...config, title: "Different" }, idempotencyKey: "db-test-idempotency", baseUrl: "https://talkform.test" }), /different config/);
  const token = new URL(created.respondentUrl).hash.slice("#token=".length);
  await getRespondentHandoff(created.id, token, { surface: "respondent", client: { name: "@talkform/react", version: "0.1.0", selfReported: true } });
  await getRespondentHandoff(created.id, token, { surface: "respondent" });
  const first = await submitRespondentHandoff(created.id, token, { values: { answer: "Reviewed" }, mode: "text" }, { surface: "respondent" });
  const repeated = await submitRespondentHandoff(created.id, token, { values: { answer: "Reviewed" }, mode: "text" });
  assert.deepEqual(repeated, first);
  await assert.rejects(() => submitRespondentHandoff(created.id, token, { values: { answer: "Changed" }, mode: "text" }), /different values/);
  const result = await getHandoffResult({ ...authenticated, scopes: ["handoffs:read"] }, created.id, { surface: "mcp" });
  await getHandoffResult({ ...authenticated, scopes: ["handoffs:read"] }, created.id, { surface: "rest" });
  assert.deepEqual(result.fields, { answer: "Reviewed" });
  assert.deepEqual(result.transcript, []);
  assert.equal(result.summary, "");
  assert.equal(result.metadata.model, "local-text");
  const events = await platformDatabase()<{ event_name: string; surface: string; client_sdk_name: string | null; client_sdk_version: string | null }[]>`
    select event_name,surface,client_sdk_name,client_sdk_version from tf_events where handoff_id=${created.id} order by id`;
  assert.deepEqual(Array.from(events), [
    { event_name: "handoff.created", surface: "rest", client_sdk_name: "@talkform/node", client_sdk_version: "1.2.3" },
    { event_name: "handoff.opened", surface: "respondent", client_sdk_name: "@talkform/react", client_sdk_version: "0.1.0" },
    { event_name: "handoff.completed", surface: "respondent", client_sdk_name: null, client_sdk_version: null },
    { event_name: "handoff.result_retrieved", surface: "mcp", client_sdk_name: null, client_sdk_version: null },
  ]);
  await platformDatabase()`update tf_handoffs set result_expires_at=now()-interval '1 second' where id=${created.id}`;
  await assert.rejects(() => submitRespondentHandoff(created.id, token, { values: { answer: "Reviewed" }, mode: "text" }), /expired/);
  const [purged] = await platformDatabase()<{ status: string; config_ciphertext: Uint8Array | null; result_ciphertext: Uint8Array | null }[]>`select status,config_ciphertext,result_ciphertext from tf_handoffs where id=${created.id}`;
  assert.deepEqual({ status: purged.status, config: purged.config_ciphertext, result: purged.result_ciphertext }, { status: "expired", config: null, result: null });
});

integration("operator aggregates exclude test and internal owners and count repeat retrieval days", async () => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.TALKFORM_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
  const suffix = `${Date.now()}_${Math.random()}`;
  const operatorId = `operator_${suffix}`;
  process.env.TALKFORM_INTERNAL_USER_IDS = operatorId;
  const externalProduction = await createProject(`external_${suffix}`, { name: "External production", environment: "production" });
  const externalTest = await createProject(`external_test_${suffix}`, { name: "External test", environment: "test" });
  const internalProduction = await createProject(operatorId, { name: "Internal production", environment: "production" });
  const config = { id: "operator-test", title: "Operator test", fields: [{ id: "answer", label: "Answer", type: "text" as const, required: true, promptTitle: "Answer", promptDetail: "Please answer" }] };
  const complete = async (project: typeof externalProduction, dedupe: string) => {
    const createdKey = await createProjectApiKey(project === internalProduction ? operatorId : project === externalTest ? `external_test_${suffix}` : `external_${suffix}`, project.id, { name: "Operator aggregate key" });
    const key = await authenticateProjectKey(new Request("https://talkform.test", { headers: { authorization: `Bearer ${createdKey.secret}` } }), "handoffs:write");
    const handoff = await createHandoff(key, { config, idempotencyKey: dedupe, baseUrl: "https://talkform.test" }, { surface: project === externalProduction ? "mcp" : "rest" });
    const token = new URL(handoff.respondentUrl).hash.slice("#token=".length);
    await getRespondentHandoff(handoff.id, token, { surface: "respondent" });
    await submitRespondentHandoff(handoff.id, token, { values: { answer: "Reviewed" }, mode: "text" }, { surface: "respondent" });
    await getHandoffResult({ ...key, scopes: ["handoffs:read"] }, handoff.id, { surface: project === externalProduction ? "mcp" : "rest" });
    return handoff.id;
  };
  const first = await complete(externalProduction, `operator-first-${suffix}`);
  const second = await complete(externalProduction, `operator-second-${suffix}`);
  await complete(externalTest, `operator-test-${suffix}`);
  await complete(internalProduction, `operator-internal-${suffix}`);
  await platformDatabase()`update tf_events set created_at=now()-interval '15 days' where handoff_id=${first} and event_name='handoff.result_retrieved'`;
  await platformDatabase()`update tf_events set created_at=now()-interval '8 days' where handoff_id=${second} and event_name='handoff.result_retrieved'`;
  await platformDatabase()`update tf_projects set created_at=now()-interval '20 days',first_result_retrieved_at=now()-interval '15 days' where id=${externalProduction.id}`;
  await platformDatabase()`insert into cost_reservations(feature,actor_key,address_key,scope_kind,scope_id,status,model,reserved_microusd,actual_microusd,actual_source,usage_complete,expires_at,settled_at) values ('realtime','operator-cost','operator-cost-address','handoff',${first},'settled','gpt-realtime-2.1-mini',400000,1234,'provider_usage_estimate',true,now()+interval '1 day',now())`;
  await platformDatabase()`insert into cost_reservations(feature,actor_key,address_key,scope_kind,scope_id,status,model,reserved_microusd,actual_microusd,actual_source,expires_at) values ('realtime','operator-cost-unknown','operator-cost-address-unknown','handoff',${second},'termination_unknown','gpt-realtime-2.1-mini',400000,500,'provider_usage_estimate',now()+interval '1 day')`;

  const usage = await getOperatorUsage(operatorId);
  assert.deepEqual(usage.summary, { externalProductionProjects: 1, activationDenominatorProjects: 1, activatedProjects: 1, repeatDenominatorProjects: 1, repeatProjects: 1, created: 2, opened: 2, submitted: 2, retrieved: 2 });
  const externalRow = usage.projects.find((project) => project.id === externalProduction.id)!;
  assert.equal(externalRow.internal, false);
  assert.equal(externalRow.retrieval_days, 2);
  assert.equal(externalRow.opened, 2);
  assert.deepEqual(externalRow.surfaceCounts.find((row) => row.event === "handoff.created"), { event: "handoff.created", surface: "mcp", count: 2 });
  assert.deepEqual(externalRow.cost, { observedProviderEstimateMicrousd: 1734, reservedUnknownExposureMicrousd: 400000, conservativeExposureMicrousd: 401234, basis: "provider_usage_estimate_plus_reserved_unknown", windowDays: 30, includesHistoricalUnknown: true });
  assert.deepEqual(usage.surfaceCounts.find((row) => row.event === "handoff.result_retrieved"), { event: "handoff.result_retrieved", surface: "mcp", count: 2 });
  assert.ok(usage.weeklyExternalProjects.some((week) => week.retrievingProjects === 1 && week.eligibleExternalProductionProjects === 1));
  assert.ok(usage.completedWeekCohorts.some((cohort) => cohort.cohortProjects === 1 && cohort.weekOneEligibleProjects === 1 && cohort.weekOneRetainedProjects === 1));
  assert.equal(usage.projects.find((project) => project.id === internalProduction.id)!.internal, true);
});
