import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { installTalkform } from "./install";

test("installer is idempotent and preserves unrelated MCP configuration", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "talkform-install-"));
  await mkdir(path.join(home, ".cursor"), { recursive: true });
  await writeFile(path.join(home, ".cursor/mcp.json"), JSON.stringify({ mcpServers: { existing: { command: "existing" } } }));

  await installTalkform({ home, clients: ["cursor"], packageVersion: "0.1.0" });
  await installTalkform({ home, clients: ["cursor"], packageVersion: "0.1.0" });

  const config = JSON.parse(await readFile(path.join(home, ".cursor/mcp.json"), "utf8"));
  assert.deepEqual(config.mcpServers.existing, { command: "existing" });
  assert.deepEqual(config.mcpServers.talkform, {
    command: "npx",
    args: ["-y", "@talkform/mcp@0.1.0"],
  });
  assert.match(await readFile(path.join(home, ".agents/skills/talkform/SKILL.md"), "utf8"), /Talkform/);
});

test("installer fails closed on malformed client JSON", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "talkform-install-bad-"));
  await mkdir(path.join(home, ".cursor"), { recursive: true });
  await writeFile(path.join(home, ".cursor/mcp.json"), "not-json");
  await assert.rejects(
    installTalkform({ home, clients: ["cursor"], packageVersion: "0.1.0" }),
    /Refusing to replace malformed JSON/,
  );
});
