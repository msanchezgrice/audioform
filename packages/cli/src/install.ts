import { lstat, mkdir, readFile, readlink, rename, symlink, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export type TalkformClient = "claude" | "codex" | "cursor";

type InstallOptions = {
  home: string;
  clients: TalkformClient[];
  packageVersion: string;
  force?: boolean;
};

const skillSource = fileURLToPath(new URL("../skills/talkform/SKILL.md", import.meta.url));

async function atomicWrite(file: string, contents: string) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.talkform-${process.pid}.tmp`;
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, file);
}

async function readJsonConfig(file: string) {
  if (!existsSync(file)) return {} as Record<string, unknown>;
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  } catch {
    throw new Error(`Refusing to replace malformed JSON in ${file}. Fix it and run the installer again.`);
  }
}

async function installJsonMcp(file: string, packageVersion: string) {
  const config = await readJsonConfig(file);
  const existingServers = config.mcpServers;
  if (existingServers !== undefined && (!existingServers || typeof existingServers !== "object" || Array.isArray(existingServers))) {
    throw new Error(`Refusing to replace invalid mcpServers in ${file}.`);
  }
  config.mcpServers = {
    ...(existingServers as Record<string, unknown> | undefined),
    talkform: { command: "npx", args: ["-y", `@talkform/mcp@${packageVersion}`] },
  };
  await atomicWrite(file, `${JSON.stringify(config, null, 2)}\n`);
}

async function installCodexMcp(file: string, packageVersion: string) {
  const source = existsSync(file) ? await readFile(file, "utf8") : "";
  const header = "[mcp_servers.talkform]";
  const block = `${header}\ncommand = "npx"\nargs = ["-y", "@talkform/mcp@${packageVersion}"]`;
  const start = source.indexOf(header);
  let next = source.trimEnd();
  if (start >= 0) {
    const afterHeader = source.indexOf("\n[", start + header.length);
    next = `${source.slice(0, start).trimEnd()}\n\n${block}${afterHeader >= 0 ? `\n\n${source.slice(afterHeader + 1).trimStart()}` : ""}`.trim();
  } else {
    next = `${next}${next ? "\n\n" : ""}${block}`;
  }
  await atomicWrite(file, `${next}\n`);
}

async function installSkill(home: string, force = false) {
  const canonical = path.join(home, ".agents/skills/talkform");
  const destination = path.join(canonical, "SKILL.md");
  const contents = await readFile(skillSource, "utf8");
  if (existsSync(destination)) {
    const current = await readFile(destination, "utf8");
    if (current !== contents && !force) {
      throw new Error(`Refusing to overwrite unmanaged skill at ${destination}. Re-run with --force to replace it.`);
    }
  }
  await mkdir(canonical, { recursive: true });
  await atomicWrite(destination, contents);
  return canonical;
}

async function linkSkill(home: string, client: TalkformClient, canonical: string, force = false) {
  const destination = path.join(home, `.${client}/skills/talkform`);
  await mkdir(path.dirname(destination), { recursive: true });
  if (existsSync(destination)) {
    const stat = await lstat(destination);
    if (stat.isSymbolicLink() && path.resolve(path.dirname(destination), await readlink(destination)) === canonical) return;
    if (!force) throw new Error(`Refusing to replace unmanaged path at ${destination}. Re-run with --force to replace it.`);
    if (stat.isDirectory()) throw new Error(`Refusing to delete directory at ${destination}; move it manually first.`);
    await unlink(destination);
  }
  await symlink(canonical, destination, "dir");
}

export async function installTalkform(options: InstallOptions) {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(options.packageVersion)) {
    throw new Error("A valid exact package version is required for a reproducible MCP install.");
  }
  const canonical = await installSkill(options.home, options.force);
  for (const client of options.clients) {
    await linkSkill(options.home, client, canonical, options.force);
    if (client === "codex") {
      await installCodexMcp(path.join(options.home, ".codex/config.toml"), options.packageVersion);
    } else {
      const file = client === "claude" ? path.join(options.home, ".claude.json") : path.join(options.home, ".cursor/mcp.json");
      await installJsonMcp(file, options.packageVersion);
    }
  }
  return { canonical, clients: options.clients };
}
