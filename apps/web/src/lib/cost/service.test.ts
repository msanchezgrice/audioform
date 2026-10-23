import assert from "node:assert/strict";
import test from "node:test";
import { createSerialMessageQueue, readOpenAIAccountReadiness, sidebandUsageComplete, summarizeTeardownDiagnostics, validRealtimeUsage } from "./service";

test("sideband close waits for delayed usage persistence in order", async () => {
  const seen: number[] = [];
  const queue = createSerialMessageQueue<number>(async (value) => {
    if (value === 1) await new Promise((resolve) => setTimeout(resolve, 15));
    seen.push(value);
  }, () => assert.fail("unexpected queue failure"));
  queue.enqueue(1);
  queue.enqueue(2);
  await queue.drain();
  assert.deepEqual(seen, [1, 2]);
});

test("sideband persistence failure is observed before drain completes", async () => {
  let unknown = false;
  const queue = createSerialMessageQueue(async () => { throw new Error("database unavailable"); }, () => { unknown = true; });
  queue.enqueue("response.done");
  await queue.drain();
  assert.equal(unknown, true);
});

test("clean sideband close without observed provider usage remains unknown", () => {
  assert.equal(sidebandUsageComplete({ observerAttached: true, socketErrored: false, usageUnknown: false, observedUsage: false, activeResponses: 0, pendingTranscriptions: 0 }), false);
  assert.equal(validRealtimeUsage({ input_token_details: {}, output_token_details: {} }), false);
  assert.equal(validRealtimeUsage({ input_token_details: { audio_tokens: 1 }, output_token_details: { audio_tokens: 0 } }), true);
});

test("teardown diagnostics aggregate only allowlisted outcomes and numeric statuses", () => {
  const summary = summarizeTeardownDiagnostics([
    { outcome: "provider_rejected", httpStatus: 404 },
    { outcome: "provider_rejected", httpStatus: 404 },
    { outcome: "acknowledged", httpStatus: 200 },
    { outcome: "request_timeout", httpStatus: null },
    { outcome: "cleanup_timeout", httpStatus: null },
  ]);
  assert.deepEqual(summary, [
    { outcome: "acknowledged", httpStatus: 200, count: 1 },
    { outcome: "cleanup_timeout", httpStatus: null, count: 1 },
    { outcome: "provider_rejected", httpStatus: 404, count: 2 },
    { outcome: "request_timeout", httpStatus: null, count: 1 },
  ]);
  assert.equal(JSON.stringify(summary).includes("callId"), false);
});

test("account readiness probe reads only allowlisted metadata and rejects redirects", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "write-only-test-key";
  try {
    let requestedUrl = "";
    let requestOptions: RequestInit | undefined;
    const result = await readOpenAIAccountReadiness(async (input, init) => {
      requestedUrl = String(input);
      requestOptions = init;
      return new Response("sensitive provider body", { status: 200, headers: {
        "openai-project": "proj_hqJUNI5zwDL2CUpYfMwGEM8V",
        "openai-organization": "org-1zdpMipnxc7A78hLjZPhgGM0",
        "x-arbitrary": "must-not-be-read",
      } });
    });
    assert.equal(requestedUrl, "https://api.openai.com/v1/models/gpt-4.1-mini");
    assert.equal(requestOptions?.method, "GET");
    assert.equal(requestOptions?.redirect, "error");
    assert.equal((requestOptions?.signal as AbortSignal).aborted, false);
    assert.deepEqual(result, {
      httpStatus: 200,
      projectId: "proj_hqJUNI5zwDL2CUpYfMwGEM8V",
      projectHeader: "known",
      organizationId: "org-1zdpMipnxc7A78hLjZPhgGM0",
      organizationHeader: "known",
      projectSelectionResults: [],
      outcome: "http_response",
    });
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes("write-only-test-key"), false);
    assert.equal(serialized.includes("sensitive provider body"), false);
    assert.equal(serialized.includes("must-not-be-read"), false);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("account readiness maps missing and unexpected headers to bounded categories", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "write-only-test-key";
  try {
    const results = await Promise.all([
      readOpenAIAccountReadiness(async () => new Response(null, { status: 401 })),
      readOpenAIAccountReadiness(async () => new Response(null, { status: 200, headers: {
        "openai-project": "proj_unrecognized_sensitive_value",
        "openai-organization": "org_unrecognized_sensitive_value",
      } })),
    ]);
    assert.deepEqual(results[0], { httpStatus: 401, projectId: null, projectHeader: "missing", organizationId: null, organizationHeader: "missing", projectSelectionResults: [], outcome: "http_response" });
    assert.deepEqual(results[1], { httpStatus: 200, projectId: null, projectHeader: "unexpected", organizationId: null, organizationHeader: "unexpected", projectSelectionResults: [], outcome: "http_response" });
    assert.doesNotMatch(JSON.stringify(results), /unrecognized_sensitive_value|write-only-test-key/);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("account readiness timeout and fetch failures are bounded and non-throwing", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "write-only-test-key";
  try {
    const keepEventLoopAlive = setTimeout(() => undefined, 5_100);
    let timeout: Awaited<ReturnType<typeof readOpenAIAccountReadiness>>;
    try {
      timeout = await readOpenAIAccountReadiness(async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }));
    } finally {
      clearTimeout(keepEventLoopAlive);
    }
    assert.deepEqual(timeout, { httpStatus: null, projectId: null, projectHeader: "missing", organizationId: null, organizationHeader: "missing", projectSelectionResults: [], outcome: "request_error" });
    const failure = await readOpenAIAccountReadiness(async () => { throw new Error("secret response detail"); });
    assert.deepEqual(failure, { httpStatus: null, projectId: null, projectHeader: "missing", organizationId: null, organizationHeader: "missing", projectSelectionResults: [], outcome: "request_error" });
    assert.doesNotMatch(JSON.stringify(failure), /secret response detail|write-only-test-key/);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("missing default identity probes each approved project without reading response bodies", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "write-only-test-key";
  const projects = [
    "proj_xGpticukjbzDoJcb3lU1IzHO",
    "proj_hqJUNI5zwDL2CUpYfMwGEM8V",
    "proj_9Hk0VRG0gHfO5r8r0D6q9DV9",
  ];
  const responses: Response[] = [];
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  try {
    const result = await readOpenAIAccountReadiness(async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      const selectedProject = new Headers(init?.headers).get("OpenAI-Project");
      const response = requests.length === 1
        ? new Response("base response must not be read", { status: 200 })
        : selectedProject === projects[0]
          ? new Response("accepted response must not be read", { status: 200 })
          : selectedProject === projects[1]
            ? new Response("rejected response must not be read", { status: 403 })
            : Promise.reject(new Error("secret provider detail"));
      if (response instanceof Response) responses.push(response);
      return response;
    });

    assert.equal(requests.length, 4);
    assert.ok(requests.every(({ url }) => url === "https://api.openai.com/v1/models/gpt-4.1-mini"));
    assert.equal(requests[0].init?.headers && new Headers(requests[0].init.headers).has("OpenAI-Project"), false);
    for (const request of requests.slice(1)) {
      assert.equal(request.init?.method, "GET");
      assert.equal(request.init?.redirect, "error");
      assert.equal(new Headers(request.init?.headers).get("Authorization"), "Bearer write-only-test-key");
      assert.equal(new Headers(request.init?.headers).get("OpenAI-Organization"), "org-1zdpMipnxc7A78hLjZPhgGM0");
      assert.ok(projects.includes(new Headers(request.init?.headers).get("OpenAI-Project") ?? ""));
      assert.ok(request.init?.signal instanceof AbortSignal);
    }
    assert.deepEqual(result, {
      httpStatus: 200,
      projectId: null,
      projectHeader: "missing",
      organizationId: null,
      organizationHeader: "missing",
      projectSelectionResults: [
        { projectId: projects[0], httpStatus: 200, outcome: "accepted" },
        { projectId: projects[1], httpStatus: 403, outcome: "non_200" },
        { projectId: projects[2], httpStatus: null, outcome: "request_error" },
      ],
      outcome: "http_response",
    });
    assert.ok(responses.every((response) => !response.bodyUsed));
    assert.doesNotMatch(JSON.stringify(result), /write-only-test-key|secret provider detail|base response|accepted response|rejected response/);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("multiple explicitly accepted projects remain ambiguous and no singleton is inferred", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "write-only-test-key";
  const projects = [
    "proj_xGpticukjbzDoJcb3lU1IzHO",
    "proj_hqJUNI5zwDL2CUpYfMwGEM8V",
    "proj_9Hk0VRG0gHfO5r8r0D6q9DV9",
  ];
  try {
    let calls = 0;
    const result = await readOpenAIAccountReadiness(async () => {
      calls += 1;
      return new Response("unused body", { status: 200 });
    });
    assert.equal(calls, 4);
    assert.equal(result.projectId, null);
    assert.equal(result.projectHeader, "missing");
    assert.deepEqual(result.projectSelectionResults, projects.map((projectId) => ({ projectId, httpStatus: 200, outcome: "accepted" })));
    assert.equal("selectedProjectId" in result, false);
    assert.equal(JSON.stringify(result).includes("unused body"), false);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});
