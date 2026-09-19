import assert from "node:assert/strict";
import test from "node:test";
import {
  audioformConfigJsonSchema,
  audioformConfigSchema,
  buildHandoffShareCopy,
  createEmptyValues,
  getCurrentPrompt,
  getRespondentQuestion,
  getRespondentQuestionDetail,
  isHttpsUrl,
  NEUTRAL_INTERVIEW_THEME,
  resolveEffectiveInterviewMode,
  resolveInterviewBranding,
  resolveInterviewTheme,
  sanitizeFontFamily,
} from "./index";

const field = {
  id: "liked_most",
  label: "What they liked",
  type: "long_text" as const,
  required: true,
  promptTitle: "What did you like most?",
  promptDetail: "Ask for one concrete moment.",
};

test("getRespondentQuestion prefers the spoken question over a label copied into visualTitle", () => {
  assert.equal(getRespondentQuestion(field), "What did you like most?");
  assert.equal(
    getRespondentQuestion({ ...field, visualTitle: "What they liked" }),
    "What did you like most?",
  );
  assert.equal(
    getRespondentQuestion({ ...field, visualTitle: "What stood out first?" }),
    "What stood out first?",
  );
});

test("theme colors must be hex and fall back to the neutral interview theme", () => {
  assert.equal(audioformConfigSchema.safeParse({
    id: "feedback",
    title: "Feedback",
    fields: [field],
    theme: { accent: "red" },
  }).success, false);
  assert.deepEqual(resolveInterviewTheme({ accent: "#112233" }), {
    ...NEUTRAL_INTERVIEW_THEME,
    accent: "#112233",
  });
  assert.deepEqual(resolveInterviewTheme({ accent: "red" }), NEUTRAL_INTERVIEW_THEME);
});

test("branding rejects non-https identity assets", () => {
  const base = { id: "feedback", title: "Feedback", fields: [field] };
  assert.equal(audioformConfigSchema.safeParse({
    ...base,
    branding: { logoUrl: "javascript:alert(1)" },
  }).success, false);
  assert.equal(audioformConfigSchema.safeParse({
    ...base,
    branding: { logoUrl: "http://example.com/logo.png" },
  }).success, false);
  assert.equal(audioformConfigSchema.safeParse({
    ...base,
    branding: { fromName: "My Forever Songs", purpose: "2 min product feedback", logoUrl: "https://cdn.example.com/logo.png" },
  }).success, true);
});

test("share copy names the sender and stays honest about text-only interviews", () => {
  const share = buildHandoffShareCopy({
    config: {
      title: "User feedback",
      description: "Help us improve the first listen.",
      branding: { fromName: "My Forever Songs", purpose: "2 min feedback" },
    },
    respondentUrl: "https://www.talkform.ai/respond/abc#token=secret",
    mode: "text",
  });
  assert.equal(share.fromName, "My Forever Songs");
  assert.equal(share.purpose, "2 min feedback");
  assert.match(share.shareText, /My Forever Songs asked for a short interview: 2 min feedback/);
  assert.doesNotMatch(share.shareText, /voice interview/);
  assert.equal(resolveEffectiveInterviewMode({ requested: "voice", voiceEligible: false }), "text");
  assert.equal(resolveEffectiveInterviewMode({ requested: "voice", voiceEligible: true }), "voice");
});

test("getRespondentQuestionDetail hides machine prompt copy unless visualDetail is distinct", () => {
  assert.equal(getRespondentQuestionDetail(field), "");
  assert.equal(getRespondentQuestionDetail({ ...field, visualDetail: field.promptDetail }), "");
  assert.equal(
    getRespondentQuestionDetail({ ...field, visualDetail: "Name one moment that stood out." }),
    "Name one moment that stood out.",
  );
});

test("getRespondentQuestion ignores blank visual titles and falls back to the field label", () => {
  assert.equal(getRespondentQuestion({ ...field, visualTitle: "   " }), "What did you like most?");
  assert.equal(getRespondentQuestion({ ...field, promptTitle: "   " }), "What they liked");
});

test("resolveInterviewBranding drops unsafe assets and only shows powered-by when opted in", () => {
  const resolved = resolveInterviewBranding({
    fromName: "  My Forever Songs  ",
    purpose: "  2 min feedback  ",
    logoUrl: "https://user:pass@cdn.example.com/logo.png",
    faviconUrl: "https://cdn.example.com/favicon.ico",
    wordmark: " MFS ",
    fontFamily: "Comic Sans MS; background:red",
    showPoweredBy: false,
  });
  assert.equal(resolved.fromName, "My Forever Songs");
  assert.equal(resolved.purpose, "2 min feedback");
  assert.equal(resolved.logoUrl, undefined);
  assert.equal(resolved.faviconUrl, "https://cdn.example.com/favicon.ico");
  assert.equal(resolved.wordmark, "MFS");
  assert.equal(resolved.fontFamily, undefined);
  assert.equal(resolved.showPoweredBy, false);
  assert.equal(resolveInterviewBranding({ showPoweredBy: true }).showPoweredBy, true);
  assert.equal(sanitizeFontFamily("Iowan Old Style, serif"), "Iowan Old Style, serif");
  assert.equal(isHttpsUrl("https://evil.example/?x=" + "a".repeat(3_000)), false);
  assert.equal(isHttpsUrl("not a url"), false);
});

test("share copy stays generic without a sender and names voice only when voice is available", () => {
  const anonymous = buildHandoffShareCopy({
    config: { title: "User feedback", description: "Help us improve the first listen." },
    respondentUrl: "https://www.talkform.ai/respond/abc#token=secret",
    mode: "voice",
  });
  assert.equal(anonymous.fromName, null);
  assert.match(anonymous.shareText, /Please complete this voice interview: Help us improve the first listen/);
  const titled = buildHandoffShareCopy({
    config: { title: "User feedback" },
    respondentUrl: "https://www.talkform.ai/respond/abc#token=secret",
    mode: "text",
  });
  assert.match(titled.shareText, /Please complete this short interview: User feedback/);
  assert.equal(resolveEffectiveInterviewMode({ requested: "text", voiceEligible: true }), "text");
  assert.equal(resolveEffectiveInterviewMode({ voiceEligible: true }), "text");
});

test("getCurrentPrompt no longer shows a label copied into visualTitle", () => {
  const prompt = getCurrentPrompt({
    id: "feedback",
    title: "Feedback",
    fields: [{ ...field, visualTitle: field.label, visualDetail: field.promptDetail }],
  }, createEmptyValues({
    id: "feedback",
    title: "Feedback",
    fields: [{ ...field, visualTitle: field.label, visualDetail: field.promptDetail }],
  }));
  assert.equal(prompt?.title, "What did you like most?");
  assert.equal(prompt?.detail, "");
});

test("branding schema rejects unsafe fonts, credentialed favicons, and unknown modes", () => {
  const base = { id: "feedback", title: "Feedback", fields: [field] };
  assert.equal(audioformConfigSchema.safeParse({
    ...base,
    branding: { fontFamily: "Arial; background:red" },
  }).success, false);
  assert.equal(audioformConfigSchema.safeParse({
    ...base,
    branding: { faviconUrl: "https://user:pass@cdn.example.com/favicon.ico" },
  }).success, false);
  assert.equal(audioformConfigSchema.safeParse({ ...base, mode: "sms" }).success, false);
  assert.equal(audioformConfigSchema.safeParse({
    ...base,
    mode: "text",
    branding: { fontFamily: "Iowan Old Style, serif" },
  }).success, true);
});

test("published config JSON schema advertises theme, branding, and mode", () => {
  const properties = audioformConfigJsonSchema.properties as {
    theme?: object;
    branding?: { properties?: Record<string, unknown> };
    mode?: { enum?: readonly string[] };
  };
  assert.ok(properties.theme);
  assert.ok(properties.branding?.properties?.fromName);
  assert.deepEqual(properties.mode?.enum, ["text", "voice"]);
});
