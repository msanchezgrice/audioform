import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const widget = read("../../../../packages/react/src/AudioformWidget.tsx");
const widgetCss = read("../../../../packages/react/src/AudioformWidget.module.css");
const gallery = read("./demo-template-gallery.tsx");
const galleryCss = read("./demo-template-gallery.module.css");
const audioformClient = read("./audioform-client.tsx");
const globalsCss = read("../app/globals.css");
const embedPage = read("../app/embed/page.tsx");
const embedCss = read("../app/embed/embed.module.css");

test("onboarding begins with informed voice or local-text choice", () => {
  assert.match(widget, /Before you begin/);
  assert.match(widget, /Start with voice/);
  assert.match(widget, /Continue with typing/);
  assert.match(widget, /OpenAI/);
  assert.match(widget, /\/privacy/);
  assert.match(widget, /\/terms/);
  assert.match(widget, /startTextInterview/);
  assert.match(widget, /isTextActive \? "Typing"/);
  assert.match(widget, /disabled=\{interviewMode === "unselected"\}/);
  assert.match(widget, /className=\{styles\.preflightChoices\}/);
  assert.match(widget, /interviewMode !== "unselected" &&/);
});

test("onboarding exposes recovery, correction, and a conversion-oriented completion state", () => {
  assert.match(widget, /Try voice again/);
  assert.match(widget, /Switch to typing/);
  assert.match(widget, /Your answers are ready/);
  assert.match(widget, /Import your form/);
  assert.match(widget, /Edit \$\{field\.label\}/);
  assert.match(widget, /field\.type === "long_text"/);
});

test("widget controls expose live status, progress, transcript, and labels to assistive technology", () => {
  assert.match(widget, /aria-live="polite"/);
  assert.match(widget, /role="alert"/);
  assert.match(widget, /role="progressbar"/);
  assert.match(widget, /aria-valuenow=\{completion\.percent\}/);
  assert.match(widget, /aria-expanded=\{transcriptOpen\}/);
  assert.match(widget, /aria-controls="talkform-transcript"/);
  assert.match(widget, /id="talkform-transcript"/);
  assert.match(widget, /htmlFor="talkform-typed-answer"/);
  assert.match(widget, /id="talkform-typed-answer"/);
});

test("template and view selectors announce selection and the demo owns the page h1", () => {
  assert.match(gallery, /<h1>/);
  assert.match(gallery, /aria-pressed=\{isActive\}/);
  assert.match(gallery, /role="switch"/);
  assert.match(gallery, /aria-checked=\{consumerMode\}/);
  assert.match(gallery, /template_selected/);
  assert.match(gallery, /view_mode_selected/);
});

test("public demo voice is safely gated and browser sessions stay local", () => {
  const appPage = read("../app/app/page.tsx");

  assert.match(widget, /voiceEnabled/);
  assert.ok(
    widget.indexOf("if (!voiceEnabled)") < widget.indexOf("navigator.mediaDevices.getUserMedia"),
    "voice gate must run before microphone access",
  );
  assert.doesNotMatch(widget, /forms\/sessions/);
  assert.match(widget, /setSessionId\(`local_/);
  assert.match(audioformClient, /voiceEnabled/);
  assert.match(audioformClient, /voiceEnabled = false/);
  assert.match(gallery, /voiceEnabled/);
  assert.match(appPage, /TALKFORM_ENABLE_PUBLIC_REALTIME\s*===\s*["']true["']/);
  assert.doesNotMatch(appPage, /NEXT_PUBLIC_TALKFORM_PUBLIC_REALTIME_ENABLED/);
});

test("public demo privacy copy matches the browser-to-OpenAI data path", () => {
  const privacy = read("../app/privacy/page.tsx");
  const faq = read("../app/faq/page.tsx");

  for (const content of [widget, privacy, faq]) {
    assert.match(content, /audio[^.]*OpenAI|OpenAI[^.]*audio/i);
    assert.match(content, /browser[^.]*until export|until[^.]*export/i);
  }
  assert.match(widget, /short-lived realtime token/i);
  assert.match(privacy, /transcript[^.]*summary[^.]*structured answers[^.]*browser/i);
  assert.match(faq, /short-lived realtime token/i);
});

test("switching templates remounts the interview instead of leaking prior answers", () => {
  assert.match(gallery, /key=\{`\$\{selectedTemplate\.id\}-\$\{consumerMode\}`\}/);
});

test("client-only widget hydration does not synchronously set state from an effect", () => {
  assert.match(audioformClient, /useSyncExternalStore/);
  assert.doesNotMatch(audioformClient, /setMounted|useEffect/);
});

test("mobile and motion CSS prevent collisions, overflow, and undersized targets", () => {
  assert.match(globalsCss, /@media \(max-width: 880px\)[\s\S]*\.siteHeader[\s\S]*height: auto/);
  assert.match(globalsCss, /\.siteNav[\s\S]*overflow-x: auto/);
  assert.match(widgetCss, /min-height: 44px/);
  assert.match(widgetCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(galleryCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(embedCss, /min-width: 0/);
  assert.match(embedCss, /max-width: 100%/);
});

test("embed page labels its decorative microphone and does not advertise unavailable hosted assets", () => {
  assert.match(embedPage, /aria-label="Microphone preview \(not interactive\)"/);
  assert.match(embedPage, /disabled/);
  assert.doesNotMatch(embedPage, /cdn\.talkform\.ai\/embed\.js/);
  assert.doesNotMatch(embedPage, /talkform\.ai\/widget\/YOUR_FORM_ID/);
  assert.match(embedPage, /Hosted iframe and script embeds are coming soon/);
  assert.match(embedPage, /not yet a published npm package/);
});
