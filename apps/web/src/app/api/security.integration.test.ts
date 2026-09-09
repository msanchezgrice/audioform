import assert from "node:assert/strict";
import test from "node:test";
import { POST as createTemplateSession } from "./forms/[formId]/sessions/route";
import { POST as createSession } from "./forms/sessions/route";
import { POST as importUrl } from "./import/url/route";
import { POST as createRealtime } from "./realtime/route";
import { GET as listSessions } from "./sessions/route";
import { GET as readSession, PUT as updateSession } from "./sessions/[sessionId]/route";
import { GET as exportSession } from "./sessions/[sessionId]/export/route";

const origin = "https://www.talkform.ai";

function jsonRequest(
  url: string,
  body: unknown,
  cookie?: string,
  requestOrigin = origin,
  forwardedFor?: string,
  bearerToken?: string,
) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(requestOrigin ? { origin: requestOrigin } : {}),
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function sessionContext(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

function formContext(formId: string) {
  return { params: Promise.resolve({ formId }) };
}

function ownerCookie(response: Response) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0] ?? "";
}

test("session APIs scope listing, reads, updates, and exports to the creating browser", async () => {
  const createdResponse = await createSession(
    jsonRequest(`${origin}/api/forms/sessions`, { formId: "lead-generation" }),
  );
  assert.equal(createdResponse.status, 200);
  const created = (await createdResponse.json()) as { session: { sessionId: string } };
  const cookie = ownerCookie(createdResponse);
  const setCookie = createdResponse.headers.get("set-cookie") ?? "";
  assert.ok(cookie);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=None/i);
  assert.match(setCookie, /Partitioned/i);

  const ownList = await listSessions(new Request(`${origin}/api/sessions`, { headers: { cookie } }));
  assert.equal(ownList.status, 200);
  assert.equal(((await ownList.json()) as { sessions: unknown[] }).sessions.length, 1);

  const otherCookie = "talkform_owner=another-browser";
  const context = sessionContext(created.session.sessionId);
  const crossRead = await readSession(
    new Request(`${origin}/api/sessions/${created.session.sessionId}`, { headers: { cookie: otherCookie } }),
    context,
  );
  assert.equal(crossRead.status, 404);

  const crossUpdate = await updateSession(
    new Request(`${origin}/api/sessions/${created.session.sessionId}`, {
      method: "PUT",
      headers: { cookie: otherCookie, "content-type": "application/json", origin },
      body: JSON.stringify({ status: "completed" }),
    }),
    context,
  );
  assert.equal(crossUpdate.status, 404);

  const crossExport = await exportSession(
    new Request(`${origin}/api/sessions/${created.session.sessionId}/export`, {
      headers: { cookie: otherCookie },
    }),
    context,
  );
  assert.equal(crossExport.status, 404);
});

test("production returns 503 for transient session APIs unless explicitly enabled", async () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldOptIn = process.env.TALKFORM_ENABLE_IN_MEMORY_SESSIONS;
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  delete process.env.TALKFORM_ENABLE_IN_MEMORY_SESSIONS;

  try {
    const createResponse = await createSession(
      jsonRequest(`${origin}/api/forms/sessions`, { formId: "lead-generation" }),
    );
    const listResponse = await listSessions(new Request(`${origin}/api/sessions`));

    assert.equal(createResponse.status, 503);
    assert.equal(listResponse.status, 503);
    assert.match(
      ((await createResponse.json()) as { error: string }).error,
      /transient session API is disabled in production/i,
    );
  } finally {
    restoreEnv("NODE_ENV", oldNodeEnv);
    restoreEnv("TALKFORM_ENABLE_IN_MEMORY_SESSIONS", oldOptIn);
  }
});

test("a valid machine bearer token works without Origin and maps to a stable owner", async () => {
  const oldApiToken = process.env.TALKFORM_API_TOKEN;
  const oldNodeEnv = process.env.NODE_ENV;
  const oldOptIn = process.env.TALKFORM_ENABLE_IN_MEMORY_SESSIONS;
  process.env.TALKFORM_API_TOKEN = "server-machine-token-for-tests";
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  process.env.TALKFORM_ENABLE_IN_MEMORY_SESSIONS = "true";

  try {
    const createResponse = await createSession(
      jsonRequest(
        `${origin}/api/forms/sessions`,
        { formId: "lead-generation" },
        undefined,
        "",
        undefined,
        "server-machine-token-for-tests",
      ),
    );
    assert.equal(createResponse.status, 200);
    assert.equal(createResponse.headers.get("set-cookie"), null);

    const created = (await createResponse.json()) as { session: { sessionId: string } };
    const machineHeaders = { authorization: "Bearer server-machine-token-for-tests" };
    const listResponse = await listSessions(
      new Request(`${origin}/api/sessions`, { headers: machineHeaders }),
    );
    const readResponse = await readSession(
      new Request(`${origin}/api/sessions/${created.session.sessionId}`, { headers: machineHeaders }),
      sessionContext(created.session.sessionId),
    );

    assert.equal(listResponse.status, 200);
    assert.equal(((await listResponse.json()) as { sessions: unknown[] }).sessions.length, 1);
    assert.equal(readResponse.status, 200);

    const invalidToken = await createSession(
      jsonRequest(
        `${origin}/api/forms/sessions`,
        { formId: "lead-generation" },
        undefined,
        "",
        undefined,
        "wrong-machine-token",
      ),
    );
    assert.equal(invalidToken.status, 401);
  } finally {
    restoreEnv("TALKFORM_API_TOKEN", oldApiToken);
    restoreEnv("NODE_ENV", oldNodeEnv);
    restoreEnv("TALKFORM_ENABLE_IN_MEMORY_SESSIONS", oldOptIn);
  }
});

test("session updates reject invalid status and malformed runtime payloads", async () => {
  const createdResponse = await createSession(
    jsonRequest(`${origin}/api/forms/sessions`, { formId: "lead-generation" }),
  );
  assert.equal(createdResponse.status, 200);
  const created = (await createdResponse.json()) as { session: { sessionId: string } };
  const cookie = ownerCookie(createdResponse);
  const context = sessionContext(created.session.sessionId);

  for (const body of [
    { status: "paused" },
    { values: [] },
    { summary: 42 },
    { summary: "Derived summaries stay browser-local." },
    { transcript: [{ id: "entry", speaker: "system", text: "bad", timestamp: Date.now() }] },
    { transcript: [{ id: "entry", speaker: "user", text: "Browser-local answer", timestamp: Date.now() }] },
    { values: { workEmail: "not-an-email" } },
    { status: "completed" },
  ]) {
    const response = await updateSession(
      new Request(`${origin}/api/sessions/${created.session.sessionId}`, {
        method: "PUT",
        headers: { cookie, "content-type": "application/json", origin },
        body: JSON.stringify(body),
      }),
      context,
    );
    assert.equal(response.status, 400);
  }
});

test("generic session creation rejects invalid JSON and oversized bodies", async () => {
  const invalidJson = await createSession(
    new Request(`${origin}/api/forms/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: "{",
    }),
  );
  const oversized = await createSession(
    jsonRequest(`${origin}/api/forms/sessions`, { padding: "x".repeat(70_000) }),
  );

  assert.equal(invalidJson.status, 400);
  assert.match(((await invalidJson.json()) as { error: string }).error, /invalid JSON request body/i);
  assert.equal(oversized.status, 413);
  assert.match(((await oversized.json()) as { error: string }).error, /request body is too large/i);
});

test("template session creation also rejects invalid JSON and oversized bodies", async () => {
  const invalidJson = await createTemplateSession(
    new Request(`${origin}/api/forms/lead-generation/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: "{",
    }),
    formContext("lead-generation"),
  );
  const oversized = await createTemplateSession(
    jsonRequest(`${origin}/api/forms/lead-generation/sessions`, { padding: "x".repeat(70_000) }),
    formContext("lead-generation"),
  );

  assert.equal(invalidJson.status, 400);
  assert.match(((await invalidJson.json()) as { error: string }).error, /invalid JSON request body/i);
  assert.equal(oversized.status, 413);
  assert.match(((await oversized.json()) as { error: string }).error, /request body is too large/i);
});

test("Realtime issuance rejects missing and cross-site origins", async () => {
  const oldApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  try {
    const missingOrigin = await createRealtime(
      jsonRequest(`${origin}/api/realtime`, { formId: "lead-generation" }, undefined, ""),
    );
    assert.equal(missingOrigin.status, 403);

    const crossSite = await createRealtime(
      jsonRequest(`${origin}/api/realtime`, { formId: "lead-generation" }, undefined, "https://evil.example"),
    );
    assert.equal(crossSite.status, 403);
  } finally {
    if (oldApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldApiKey;
  }
});

test("production returns 503 for public Realtime issuance unless explicitly enabled", async () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldOptIn = process.env.TALKFORM_ENABLE_PUBLIC_REALTIME;
  const oldApiKey = process.env.OPENAI_API_KEY;
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  delete process.env.TALKFORM_ENABLE_PUBLIC_REALTIME;
  process.env.OPENAI_API_KEY = "test-key";

  try {
    const response = await createRealtime(
      jsonRequest(`${origin}/api/realtime`, { formId: "lead-generation" }),
    );
    assert.equal(response.status, 503);
    assert.match(
      ((await response.json()) as { error: string }).error,
      /public Realtime issuance is disabled in production/i,
    );
  } finally {
    restoreEnv("NODE_ENV", oldNodeEnv);
    restoreEnv("TALKFORM_ENABLE_PUBLIC_REALTIME", oldOptIn);
    restoreEnv("OPENAI_API_KEY", oldApiKey);
  }
});

test("an explicit production Realtime opt-in still fails closed without durable cost storage", async () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldOptIn = process.env.TALKFORM_ENABLE_PUBLIC_REALTIME;
  const oldDatabaseUrl = process.env.DATABASE_URL;
  const oldEncryptionKey = process.env.TALKFORM_DATA_ENCRYPTION_KEY;
  let fetchCalls = 0;
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  process.env.TALKFORM_ENABLE_PUBLIC_REALTIME = "true";
  process.env.TALKFORM_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  delete process.env.DATABASE_URL;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalls += 1; return new Response(); };
  try {
    const response = await createRealtime(jsonRequest(`${origin}/api/realtime`, { formId: "lead-generation" }));
    assert.equal(response.status, 500);
    assert.equal(fetchCalls, 0);
    assert.doesNotMatch(await response.text(), /ek_|client.secret|OPENAI_API_KEY/i);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("NODE_ENV", oldNodeEnv);
    restoreEnv("TALKFORM_ENABLE_PUBLIC_REALTIME", oldOptIn);
    restoreEnv("DATABASE_URL", oldDatabaseUrl);
    restoreEnv("TALKFORM_DATA_ENCRYPTION_KEY", oldEncryptionKey);
  }
});

test("Realtime lease rejects oversized configuration before durable allocation or OpenAI", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; return new Response(); };
  try {
    const response = await createRealtime(jsonRequest(`${origin}/api/realtime`, { config: { padding: "x".repeat(70_000) } }));
    assert.equal(response.status, 413);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("URL import rejects cross-site requests before any outbound fetch", async () => {
  const response = await importUrl(
    jsonRequest(`${origin}/api/import/url`, {}, undefined, "https://evil.example"),
  );
  assert.equal(response.status, 403);
});

test("URL import reports blocked private-network targets as a client error", async () => {
  const response = await importUrl(
    jsonRequest(`${origin}/api/import/url`, { url: "http://127.0.0.1/admin" }),
  );
  assert.equal(response.status, 400);
  assert.match(((await response.json()) as { error: string }).error, /public internet/i);
});

test("URL import rate-limits repeated outbound-fetch attempts", async () => {
  const oldLimit = process.env.TALKFORM_IMPORT_PER_MINUTE;
  process.env.TALKFORM_IMPORT_PER_MINUTE = "2";
  try {
    const cookie = "talkform_owner=stable-import-browser";
    const ip = "203.0.113.99";
    const first = await importUrl(
      jsonRequest(`${origin}/api/import/url`, { url: "http://127.0.0.1/one" }, cookie, origin, ip),
    );
    const second = await importUrl(
      jsonRequest(`${origin}/api/import/url`, { url: "http://127.0.0.1/two" }, cookie, origin, ip),
    );
    const limited = await importUrl(
      jsonRequest(`${origin}/api/import/url`, { url: "http://127.0.0.1/three" }, cookie, origin, ip),
    );

    assert.equal(first.status, 400);
    assert.equal(second.status, 400);
    assert.equal(limited.status, 429);
  } finally {
    if (oldLimit === undefined) delete process.env.TALKFORM_IMPORT_PER_MINUTE;
    else process.env.TALKFORM_IMPORT_PER_MINUTE = oldLimit;
  }
});
