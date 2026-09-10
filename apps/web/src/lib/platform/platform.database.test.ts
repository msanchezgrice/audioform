import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { authenticateProjectKey } from "./auth";
import { createHandoff, getHandoffResult, getRespondentHandoff, submitRespondentHandoff } from "./handoffs";
import { platformDatabase } from "./database";
import { createProject, createProjectApiKey, getProjectDashboard, revokeProjectApiKey } from "./projects";
import { getOperatorUsage } from "./operator";
import { claimAgentWorkspace, createManagedProjectApiKey, registerAgentWorkspace, revokeManagedProjectApiKey } from "./registration";
import { PlatformError } from "./types";

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

integration("machine registration is one-time, quota-bound, claimable, and subject to atomic handoff capacity", async () => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.TALKFORM_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
  const uniqueAddress = (label: string) => Buffer.from(`${label}:${Date.now()}:${Math.random()}`.padEnd(32, "x").slice(0, 32)).toString("base64url");
  const addressKey = uniqueAddress("primary");
  const created = await registerAgentWorkspace({
    addressKey,
    input: { name: "Database agent", environment: "test", idempotencyKey: randomUUID() },
    baseUrl: "https://talkform.test",
    eventContext: { surface: "rest", client: { name: "@talkform/node", version: "1.0.0", selfReported: true } },
  });
  assert.equal(created.project.ownerKind, "machine");
  assert.equal(created.project.environment, "test");
  assert.equal(created.project.dailyHandoffLimit, 10);
  assert.equal(created.project.voiceEligible, false);
  assert.equal(created.limits.voiceEligible, false);
  assert.equal(created.secret.startsWith(created.key.prefix), true);
  assert.equal(created.registration.verifiedHuman, false);
  const [stored] = await platformDatabase()<{
    clerk_user_id: string | null; owner_kind: string; daily_handoff_limit: number; secret_hash: Uint8Array;
    raw_secret_columns: number; registrations: number; operator_registrations: number;
  }[]>`
    select p.clerk_user_id,p.owner_kind,p.daily_handoff_limit,k.secret_hash,
      (select count(*)::int from information_schema.columns where table_name='tf_agent_registrations' and column_name ilike '%secret%') raw_secret_columns,
      (select count(*)::int from tf_agent_registrations where project_id=p.id) registrations,
      (select count(*)::int from tf_operator_registrations where source_key=${created.registration.id}) operator_registrations
    from tf_projects p join tf_api_keys k on k.project_id=p.id where p.id=${created.project.id} and k.id=${created.key.id}
  `;
  assert.deepEqual({ clerk: stored.clerk_user_id, kind: stored.owner_kind, limit: stored.daily_handoff_limit }, { clerk: null, kind: "machine", limit: 10 });
  assert.equal(Buffer.from(stored.secret_hash).includes(Buffer.from(created.secret)), false);
  assert.equal(stored.raw_secret_columns, 0);
  assert.equal(stored.registrations, 1);
  assert.equal(stored.operator_registrations, 1);

  const replayKey = randomUUID();
  const replayAddress = uniqueAddress("replay");
  const replayed = await registerAgentWorkspace({ addressKey: replayAddress, input: { idempotencyKey: replayKey }, baseUrl: "https://talkform.test" });
  await assert.rejects(
    () => registerAgentWorkspace({ addressKey: uniqueAddress("replay-new-network"), input: { idempotencyKey: replayKey }, baseUrl: "https://talkform.test" }),
    (error: unknown) => {
      if (!(error instanceof PlatformError) || error.code !== "registration_exists") return false;
      assert.deepEqual(error.details, { registrationId: replayed.registration.id, projectId: replayed.project.id });
      assert.equal("secret" in (error.details ?? {}), false);
      return true;
    },
  );
  const [{ count: replayCount }] = await platformDatabase()<{ count: string }[]>`select count(*)::text as count from tf_agent_registrations where project_id=${replayed.project.id}`;
  assert.equal(replayCount, "1");

  const sharedAddress = uniqueAddress("shared");
  const registrations = await Promise.allSettled(Array.from({ length: 4 }, (_, index) => registerAgentWorkspace({
    addressKey: sharedAddress,
    input: { name: `Concurrent agent ${index}`, idempotencyKey: randomUUID() },
    baseUrl: "https://talkform.test",
  })));
  assert.equal(registrations.filter((result) => result.status === "fulfilled").length, 3);
  assert.equal(registrations.filter((result) => result.status === "rejected" && result.reason?.code === "registration_address_quota").length, 1);

  const machineKey = await authenticateProjectKey(new Request("https://talkform.test", { headers: { authorization: `Bearer ${created.secret}` } }), "project:manage");
  assert.equal(machineKey.ownerKind, "machine");
  assert.equal(machineKey.voiceEligible, false);
  const config = { id: "machine-quota", title: "Machine quota", fields: [{ id: "answer", label: "Answer", type: "text" as const, required: true, promptTitle: "Answer", promptDetail: "Please answer" }] };
  const machineHandoffAttempts = await Promise.allSettled(Array.from({ length: 11 }, (_, index) => createHandoff(machineKey, { config, idempotencyKey: `machine-quota-${randomUUID()}-${index}`, baseUrl: "https://talkform.test" })));
  assert.equal(machineHandoffAttempts.filter((result) => result.status === "fulfilled").length, 10);
  assert.equal(machineHandoffAttempts.filter((result) => result.status === "rejected" && result.reason?.code === "daily_quota_exceeded").length, 1);
  const machineHandoff = machineHandoffAttempts.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createHandoff>>> => result.status === "fulfilled")!.value;
  const machineToken = new URL(machineHandoff.respondentUrl).hash.slice("#token=".length);
  await assert.rejects(
    () => submitRespondentHandoff(machineHandoff.id, machineToken, { values: { answer: "Cannot claim voice usage" }, mode: "voice" }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "voice_not_available",
  );
  assert.equal((await getRespondentHandoff(machineHandoff.id, machineToken)).status, "pending");

  const rotated = await createManagedProjectApiKey(machineKey, { name: "Rotated key" });
  const rotatedAuth = await authenticateProjectKey(new Request("https://talkform.test", { headers: { authorization: `Bearer ${rotated.secret}` } }), "project:manage");
  await revokeManagedProjectApiKey(rotatedAuth, created.key.id);
  await assert.rejects(() => authenticateProjectKey(new Request("https://talkform.test", { headers: { authorization: `Bearer ${created.secret}` } }), "handoffs:read"), /Invalid API key/);

  const owner = `claimed_owner_${Date.now()}_${Math.random()}`;
  const claimed = await claimAgentWorkspace(owner, rotatedAuth);
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.project.ownerKind, "human");
  assert.equal(claimed.project.dailyHandoffLimit, 100);
  assert.equal(claimed.project.voiceEligible, true);
  const claimedAuth = await authenticateProjectKey(new Request("https://talkform.test", { headers: { authorization: `Bearer ${rotated.secret}` } }), "project:manage");
  assert.equal(claimedAuth.ownerKind, "human");
  assert.equal(claimedAuth.voiceEligible, true);

  const fullOwner = `full_claim_owner_${Date.now()}_${Math.random()}`;
  await Promise.all(Array.from({ length: 5 }, (_, index) => createProject(fullOwner, { name: `Full owner ${index}`, environment: "test" })));
  const unclaimable = await registerAgentWorkspace({
    addressKey: uniqueAddress("unclaimable"),
    input: { name: "Cannot bypass account cap", environment: "test", idempotencyKey: randomUUID() },
    baseUrl: "https://talkform.test",
  });
  const unclaimableKey = await authenticateProjectKey(new Request("https://talkform.test", { headers: { authorization: `Bearer ${unclaimable.secret}` } }), "project:manage");
  await assert.rejects(() => claimAgentWorkspace(fullOwner, unclaimableKey), (error: unknown) => error instanceof Error && "code" in error && error.code === "project_limit");

  await platformDatabase()`
    insert into tf_global_daily_usage(usage_date,handoffs_created)
    values ((now() at time zone 'utc')::date,998)
    on conflict(usage_date) do update set handoffs_created=998
  `;
  const capacityAttempts = await Promise.allSettled(Array.from({ length: 3 }, (_, index) => createHandoff(claimedAuth, {
    config,
    idempotencyKey: `shared-capacity-${randomUUID()}-${index}`,
    baseUrl: "https://talkform.test",
  })));
  assert.equal(capacityAttempts.filter((result) => result.status === "fulfilled").length, 2);
  assert.equal(capacityAttempts.filter((result) => result.status === "rejected" && result.reason?.code === "shared_capacity_reached").length, 1);
  const denialRows = await platformDatabase()<{ capacity_kind: string; denial_reason: string; denial_count: number }[]>`
    select capacity_kind,denial_reason,sum(denial_count)::int as denial_count
    from tf_operator_capacity_denials
    where (capacity_kind='registrations' and denial_reason='address') or (capacity_kind='handoffs' and denial_reason='global')
    group by capacity_kind,denial_reason
  `;
  assert.ok(denialRows.some((row) => row.capacity_kind === "registrations" && row.denial_reason === "address" && row.denial_count >= 1));
  assert.ok(denialRows.some((row) => row.capacity_kind === "handoffs" && row.denial_reason === "global" && row.denial_count >= 1));
  const [{ handoffs_created: globalCount }] = await platformDatabase()<{ handoffs_created: number }[]>`select handoffs_created from tf_global_daily_usage where usage_date=(now() at time zone 'utc')::date`;
  assert.equal(globalCount, 1000);
  const firstSucceeded = capacityAttempts.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createHandoff>>> => result.status === "fulfilled")!.value;
  const source = await platformDatabase()<{ idempotency_key: string }[]>`select idempotency_key from tf_handoffs where id=${firstSucceeded.id}`;
  const replayAtCapacity = await createHandoff(claimedAuth, { config, idempotencyKey: source[0].idempotency_key, baseUrl: "https://talkform.test" });
  assert.equal(replayAtCapacity.id, firstSucceeded.id);
  await platformDatabase()`delete from tf_global_daily_usage where usage_date=(now() at time zone 'utc')::date`;

  const fixtureName = `Registration global quota ${randomUUID()}`;
  const [{ count: registrationsToday }] = await platformDatabase()<{ count: number }[]>`
    select count(*)::int as count from tf_agent_registrations
    where created_at>=date_trunc('day',now() at time zone 'utc') at time zone 'utc'
  `;
  assert.ok(registrationsToday < 99, "isolated registration test database must begin below the global quota boundary");
  await platformDatabase()`
    with inserted_projects as (
      insert into tf_projects(clerk_user_id,owner_kind,name,environment,daily_handoff_limit)
      select null,'machine',${fixtureName},'test',${10}
      from generate_series(1,${99 - registrationsToday})
      returning id
    )
    insert into tf_agent_registrations(project_id,address_key,idempotency_hash,requested_name)
    select id,
      translate(rtrim(encode(digest(id::text,'sha256'),'base64'),'='),'+/','-_'),
      digest('registration-fixture:'||id::text,'sha256'),
      ${fixtureName}
    from inserted_projects
  `;
  const globalRegistrationAttempts = await Promise.allSettled(["one", "two"].map((suffix) => registerAgentWorkspace({
    addressKey: uniqueAddress(`global-${suffix}`),
    input: { name: fixtureName, environment: "test", idempotencyKey: randomUUID() },
    baseUrl: "https://talkform.test",
  })));
  assert.equal(globalRegistrationAttempts.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(globalRegistrationAttempts.filter((result) => result.status === "rejected" && result.reason?.code === "registration_global_quota").length, 1);
  const [{ denial_count: globalRegistrationDenials }] = await platformDatabase()<{ denial_count: number }[]>`
    select coalesce(sum(denial_count),0)::int as denial_count from tf_operator_capacity_denials
    where capacity_kind='registrations' and denial_reason='global'
  `;
  assert.ok(globalRegistrationDenials >= 1);
  await platformDatabase()`delete from tf_projects where name=${fixtureName}`;
  assert.equal(machineHandoffAttempts.filter((result) => result.status === "fulfilled").length, 10);
});
