import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createEmptyValues } from "@talkform/core";
import {
  decryptPlatformData,
  encryptPlatformData,
  hashSecret,
  validateAudioformConfig,
  validateRespondentSubmission,
} from "./auth";
import { platformClientMetadata, platformEventContext } from "./events";
import { validateAgentRegistrationInput } from "./registration";
import { platformRequestAddressKey } from "../../app/api/v1/_lib/http";
import { publicCreatedHandoff, type CreatedPlatformHandoff } from "./types";

const config = {
  id: "lead-intake",
  title: "Lead intake",
  fields: [
    {
      id: "email",
      label: "Email",
      type: "text" as const,
      required: true,
      promptTitle: "What is your email?",
      promptDetail: "Use a business email.",
    },
    {
      id: "teamSize",
      label: "Team size",
      type: "number" as const,
      required: false,
      promptTitle: "How large is the team?",
      promptDetail: "An estimate is fine.",
      validation: { min: 1, max: 1000 },
    },
  ],
};

test("platform encryption is authenticated and bound to AAD", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const ciphertext = encryptPlatformData({ hello: "world" }, "handoff-1:config", key);
  assert.deepEqual(decryptPlatformData(ciphertext, "handoff-1:config", key), { hello: "world" });
  assert.throws(() => decryptPlatformData(ciphertext, "handoff-2:config", key));
});

test("secret hashes are deterministic without retaining the secret", () => {
  const first = hashSecret("tfk_test_secret");
  assert.equal(first.equals(hashSecret("tfk_test_secret")), true);
  assert.equal(first.equals(hashSecret("tfk_other_secret")), false);
  assert.equal(first.toString("utf8").includes("tfk_test_secret"), false);
});

test("hosted config validation accepts product branding and rejects unsafe assets", () => {
  const branded = {
    ...config,
    mode: "text" as const,
    branding: {
      fromName: "My Forever Songs",
      purpose: "2 min feedback",
      logoUrl: "https://cdn.example.com/logo.png",
    },
    theme: { accent: "#111111", surface: "#f3efe8", panel: "#ffffff" },
  };
  assert.deepEqual(validateAudioformConfig(branded), branded);
  assert.throws(() => validateAudioformConfig({
    ...config,
    branding: { logoUrl: "http://insecure.example/logo.png" },
  }), /Invalid Talkform config/);
});

test("hosted config validation enforces field and byte limits", () => {
  assert.deepEqual(validateAudioformConfig(config), config);
  assert.throws(() => validateAudioformConfig(undefined), /Invalid Talkform config/);
  assert.throws(() => validateAudioformConfig({ ...config, fields: [{ ...config.fields[0], id: "__proto__" }] }), /Invalid Talkform config/);
  assert.throws(() => validateAudioformConfig({ ...config, fields: [{ ...config.fields[0], validation: { pattern: "(a+)+$" } }] }), /Invalid Talkform config/);
  assert.throws(() => validateAudioformConfig({ ...config, fields: Array.from({ length: 51 }, (_, i) => ({
    ...config.fields[0],
    id: `field-${i}`,
  })) }), /50 fields/);
  assert.throws(() => validateAudioformConfig({ ...config, description: "x".repeat(70_000) }), /64 KB/);
});

test("respondent submission enforces the exact configured field contract", () => {
  assert.deepEqual(validateRespondentSubmission(config, {
    values: { email: "  hello@example.com  ", teamSize: 12 },
    mode: "voice",
  }), {
    values: { email: "hello@example.com", teamSize: 12 },
    mode: "voice",
  });
  assert.throws(() => validateRespondentSubmission(config, {
    values: { email: "hello@example.com", ignored: "nope" }, mode: "text",
  }), /Invalid submission/);
  assert.throws(() => validateRespondentSubmission(config, {
    values: { email: "hello@example.com", teamSize: "12" }, mode: "text",
  }), /Invalid submission/);
  assert.throws(() => validateRespondentSubmission(config, {
    values: { email: "hello@example.com", teamSize: 5000 },
    mode: "text",
  }), /Invalid submission/);
  assert.throws(() => validateRespondentSubmission(config, { values: {}, mode: "text" }), /Invalid submission/);
  assert.deepEqual(validateRespondentSubmission(config, {
    values: { ...createEmptyValues(config), email: "hello@example.com" }, mode: "text",
  }).values, { email: "hello@example.com", teamSize: null });
});

test("event context trusts the server surface and bounds self-reported SDK labels", () => {
  const request = new Request("https://talkform.test/api/v1/handoffs", { headers: {
    "x-talkform-sdk": "@talkform/node",
    "x-talkform-sdk-version": "1.2.3-beta.1",
  } });
  assert.deepEqual(platformEventContext(request, "rest"), {
    surface: "rest",
    client: { name: "@talkform/node", version: "1.2.3-beta.1", selfReported: true },
  });
  assert.equal(platformClientMetadata(new Request("https://talkform.test", { headers: {
    "x-talkform-sdk": "bad sdk name",
    "x-talkform-sdk-version": "x".repeat(33),
  } })), null);
});

test("agent registration accepts only a UUIDv4 idempotency key and no identity claims", () => {
  assert.deepEqual(validateAgentRegistrationInput({ idempotencyKey: "59a39e19-d625-4d38-923b-b0fb92f1cb4e" }), {
    name: "Agent workspace",
    environment: "production",
    idempotencyKey: "59a39e19-d625-4d38-923b-b0fb92f1cb4e",
  });
  assert.deepEqual(validateAgentRegistrationInput({ name: "  Research agent  ", environment: "test" }, "7C91FB9C-EA54-49E0-BA2E-F53C4BE96087"), {
    name: "Research agent",
    environment: "test",
    idempotencyKey: "7c91fb9c-ea54-49e0-ba2e-f53c4be96087",
  });
  assert.throws(() => validateAgentRegistrationInput({ email: "agent@example.com", idempotencyKey: "59a39e19-d625-4d38-923b-b0fb92f1cb4e" }), /only name, environment, and idempotencyKey/);
  assert.throws(() => validateAgentRegistrationInput({ environment: "preview", idempotencyKey: "59a39e19-d625-4d38-923b-b0fb92f1cb4e" }), /production or test/);
  assert.throws(() => validateAgentRegistrationInput({ idempotencyKey: "not-random" }), /UUIDv4/);
  assert.throws(() => validateAgentRegistrationInput({ idempotencyKey: "59a39e19-d625-1d38-923b-b0fb92f1cb4e" }), /UUIDv4/);
});

function createdHandoff(overrides: Partial<CreatedPlatformHandoff> = {}): CreatedPlatformHandoff {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "22222222-2222-4222-8222-222222222222",
    status: "pending",
    createdAt: "2026-09-19T00:00:00.000Z",
    expiresAt: "2026-09-26T00:00:00.000Z",
    completedAt: null,
    resultExpiresAt: null,
    respondentUrl: "https://www.talkform.ai/respond/abc#token=secret",
    title: "User feedback",
    purpose: "2 min feedback",
    fromName: "My Forever Songs",
    shareText: "My Forever Songs asked for a short interview: 2 min feedback\nhttps://www.talkform.ai/respond/abc#token=secret",
    mode: "text",
    voiceEligible: false,
    claimUrl: "https://www.talkform.ai/dashboard",
    note: "This workspace is text-only until a signed-in owner claims it at claimUrl. Share the text interview, or claim first for voice.",
    ...overrides,
  };
}

test("handoff create response builds claimUrl and a text-only note for machine voice requests", () => {
  const source = readFileSync(path.resolve(process.cwd(), "apps/web/src/lib/platform/handoffs.ts"), "utf8");
  assert.match(source, /!extras\.voiceEligible \? \{ claimUrl: `\$\{origin\}\/dashboard` \}/);
  assert.match(source, /requested === "voice" && !extras\.voiceEligible/);
  assert.match(source, /Share the text interview, or claim first for voice/);
  assert.match(source, /buildHandoffShareCopy/);
  assert.match(source, /resolveEffectiveInterviewMode/);
  assert.match(source, /isWorkspaceVoiceEligible\(\)/);
  assert.doesNotMatch(source, /submission\.mode === "voice" && row\.owner_kind !== "human"/);
});

test("machine workspaces are voice eligible under shared realtime caps", async () => {
  const { isWorkspaceVoiceEligible } = await import("./voice");
  assert.equal(isWorkspaceVoiceEligible(), true);
  const auth = readFileSync(path.resolve(process.cwd(), "apps/web/src/lib/platform/auth.ts"), "utf8");
  const registration = readFileSync(path.resolve(process.cwd(), "apps/web/src/lib/platform/registration.ts"), "utf8");
  assert.match(auth, /voiceEligible: isWorkspaceVoiceEligible\(\)/);
  assert.match(registration, /voiceEligible: isWorkspaceVoiceEligible\(\)/);
});

test("public handoff create payload includes shareText and claimUrl only when voice is unavailable", () => {
  const machine = publicCreatedHandoff(createdHandoff());
  assert.equal(machine.shareText.includes("My Forever Songs asked for a short interview"), true);
  assert.equal(machine.mode, "text");
  assert.equal(machine.voiceEligible, false);
  assert.equal(machine.claimUrl, "https://www.talkform.ai/dashboard");
  assert.match(machine.note ?? "", /claimUrl/);
  assert.equal("projectId" in machine, false);

  const human = publicCreatedHandoff(createdHandoff({
    voiceEligible: true,
    mode: "voice",
    claimUrl: undefined,
    note: undefined,
  }));
  assert.equal(human.voiceEligible, true);
  assert.equal("claimUrl" in human, false);
  assert.equal("note" in human, false);
});

test("registration address identity is stable, purpose-bound, and fails closed", () => {
  const originalVercel = process.env.VERCEL;
  const originalPepper = process.env.TALKFORM_RATE_LIMIT_PEPPER;
  delete process.env.VERCEL;
  process.env.TALKFORM_RATE_LIMIT_PEPPER = "registration-test-pepper-value-at-least-32-bytes";
  try {
    const first = platformRequestAddressKey(new Request("https://talkform.test", { headers: { "x-real-ip": "192.0.2.10" } }), "agent-registration");
    const repeated = platformRequestAddressKey(new Request("https://talkform.test", { headers: { "x-real-ip": "192.0.2.10" } }), "agent-registration");
    const otherPurpose = platformRequestAddressKey(new Request("https://talkform.test", { headers: { "x-real-ip": "192.0.2.10" } }), "other");
    assert.equal(first, repeated);
    assert.notEqual(first, otherPurpose);
    assert.match(first, /^[A-Za-z0-9_-]{43}$/);
    assert.throws(() => platformRequestAddressKey(new Request("https://talkform.test")), /stable request identity/);
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = originalVercel;
    if (originalPepper === undefined) delete process.env.TALKFORM_RATE_LIMIT_PEPPER; else process.env.TALKFORM_RATE_LIMIT_PEPPER = originalPepper;
  }
});
