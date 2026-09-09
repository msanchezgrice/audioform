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
