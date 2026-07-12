import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(pathname: string) {
  return readFileSync(pathname, "utf8");
}

test("production docs state the hosted API boundary and explicit opt-ins", () => {
  const readme = source("README.md");
  const httpDocs = source("content/docs/http-api.md");
  const gettingStarted = source("content/docs/getting-started.md");
  const home = source("apps/web/src/app/page.tsx");

  for (const content of [readme, httpDocs, gettingStarted, home]) {
    assert.match(content, /disabled in hosted production by default/i);
    assert.match(content, /durable session store/i);
    assert.match(content, /distributed rate limit/i);
    assert.match(content, /server authentication/i);
  }
  assert.match(httpDocs, /TALKFORM_ENABLE_IN_MEMORY_SESSIONS/);
  assert.match(httpDocs, /TALKFORM_ENABLE_PUBLIC_REALTIME/);
  assert.match(gettingStarted, /TALKFORM_API_TOKEN/);
});

test("CLI documents bearer auth while MCP stays within its local schema and template boundary", () => {
  const cliDocs = source("content/docs/cli.md");
  const mcpDocs = source("content/docs/mcp.md");

  assert.match(cliDocs, /AUDIOFORM_API_TOKEN/);
  assert.match(cliDocs, /TALKFORM_API_TOKEN/);
  assert.match(mcpDocs, /talkform:\/\/templates/);
  assert.match(mcpDocs, /local schema|local config/i);
  assert.doesNotMatch(mcpDocs, /audioform\.(?:create_session|get_session|export_session|list_exports)/);
  assert.doesNotMatch(mcpDocs, /coordinates browser-driven sessions/i);
});
