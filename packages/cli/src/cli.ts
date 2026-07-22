#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  AI_SKILL_TUTOR_TEMPLATE,
  audioformConfigSchema,
  listAudioformTemplates,
} from "@talkform/core";
import { apiRequestHeaders } from "./api-client";
import { installTalkform, type TalkformClient } from "./install";

const args = process.argv.slice(2);
const command = args[0];
const baseUrl = process.env.AUDIOFORM_BASE_URL?.trim() || "http://localhost:3000";
const packageVersion = "0.1.0";

function print(value: unknown) {
  process.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`);
}

async function readConfigFile(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function initConfig() {
  const absolutePath = path.resolve(process.cwd(), "talkform.config.json");
  await fs.writeFile(absolutePath, JSON.stringify(AI_SKILL_TUTOR_TEMPLATE, null, 2));
  print(`Wrote ${absolutePath}`);
}

async function validateConfig(filePath?: string) {
  if (!filePath) {
    throw new Error("Usage: audioform validate <config>");
  }
  const parsed = audioformConfigSchema.safeParse(await readConfigFile(filePath));
  if (!parsed.success) {
    print({
      ok: false,
      issues: parsed.error.issues,
    });
    process.exitCode = 1;
    return;
  }

  print({
    ok: true,
    config: parsed.data,
  });
}

async function exportSession() {
  const sessionFlagIndex = args.indexOf("--session");
  const formatFlagIndex = args.indexOf("--format");
  const sessionId = sessionFlagIndex >= 0 ? args[sessionFlagIndex + 1] : "";
  const format = formatFlagIndex >= 0 ? args[formatFlagIndex + 1] : "json";

  if (!sessionId) {
    throw new Error("Usage: audioform export --session <id> --format json|markdown");
  }

  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/export?format=${format}`, {
    headers: apiRequestHeaders(),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text);
  }
  print(text);
}

function runDevServer() {
  const child = spawn("pnpm", ["--filter", "@talkform/web", "dev"], {
    stdio: "inherit",
    cwd: path.resolve(process.cwd()),
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

async function main() {
  if (command === "install") {
    const clientFlag = args.indexOf("--client");
    const requested = clientFlag >= 0 ? args[clientFlag + 1] : "";
    const supported: TalkformClient[] = ["claude", "codex", "cursor"];
    if (!args.includes("--all") && !supported.includes(requested as TalkformClient)) {
      throw new Error("Usage: talkform install --all | --client claude|codex|cursor [--force]");
    }
    const clients = args.includes("--all") ? supported : [requested as TalkformClient];
    const result = await installTalkform({
      home: process.env.HOME || process.cwd(),
      clients,
      packageVersion,
      force: args.includes("--force"),
    });
    print(`Installed Talkform skill at ${result.canonical} and configured: ${result.clients.join(", ")}`);
    return;
  }

  if (command === "templates") {
    print(listAudioformTemplates());
    return;
  }

  if (command === "init") {
    await initConfig();
    return;
  }

  if (command === "validate") {
    await validateConfig(args[1]);
    return;
  }

  if (command === "export") {
    await exportSession();
    return;
  }

  if (command === "dev") {
    runDevServer();
    return;
  }

  print([
    "Talkform CLI",
    "",
    "Commands:",
    "  talkform install --all | --client claude|codex|cursor",
    "  talkform templates",
    "  talkform init",
    "  talkform validate <config>",
    "  talkform dev",
    "  talkform export --session <id> --format json|markdown",
  ].join("\n"));
}

void main().catch((error) => {
  print(error instanceof Error ? error.message : "Unknown CLI failure");
  process.exit(1);
});
