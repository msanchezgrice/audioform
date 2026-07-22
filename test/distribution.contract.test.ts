import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const publicPackages = ["core", "react", "cli", "mcp"];

test("public packages expose built files instead of TypeScript source", () => {
  for (const name of publicPackages) {
    const packageRoot = path.join(root, "packages", name);
    const manifest = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
    assert.equal(manifest.private, undefined, `${manifest.name} must not be private`);
    assert.equal(manifest.publishConfig?.access, "public");
    assert.ok(Array.isArray(manifest.files) && manifest.files.includes("dist"));
    assert.match(JSON.stringify(manifest.exports ?? manifest.bin), /dist\//);
    assert.ok(existsSync(path.join(packageRoot, "README.md")));
  }
});

test("MCP registry identity and npm package identity stay synchronized", () => {
  const manifest = JSON.parse(readFileSync(path.join(root, "packages/mcp/package.json"), "utf8"));
  const registry = JSON.parse(readFileSync(path.join(root, "packages/mcp/server.json"), "utf8"));
  assert.equal(manifest.mcpName, "io.github.msanchezgrice/talkform");
  assert.equal(registry.name, manifest.mcpName);
  assert.equal(registry.version, manifest.version);
  assert.equal(registry.packages[0].identifier, manifest.name);
  assert.equal(registry.packages[0].version, manifest.version);
});
