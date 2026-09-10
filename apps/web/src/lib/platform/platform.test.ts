import assert from "node:assert/strict";
import test from "node:test";
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
