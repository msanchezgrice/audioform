import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const webRoot = path.resolve(process.cwd(), "apps/web");
const appRoot = path.join(webRoot, "src/app");

function read(relativePath: string) {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

test("the release ships a measured guided-pilot purchase path", () => {
  for (const route of [
    "pilot/page.tsx",
    "pilot/pilot-form.tsx",
    "pilot/success/page.tsx",
    "api/pilot/route.ts",
    "api/pilot/checkout/route.ts",
  ]) {
    assert.ok(existsSync(path.join(appRoot, route)), `${route} is missing`);
  }

  const pilotPage = read("src/app/pilot/page.tsx");
  const pilotForm = read("src/app/pilot/pilot-form.tsx");
  const webhook = read("src/app/api/billing/webhook/route.ts");
  assert.match(pilotPage, /one form/i);
  assert.match(pilotPage, /one workflow/i);
  assert.match(pilotPage, /one-time/i);
  assert.match(pilotPage, /measured/i);
  assert.match(pilotForm, /data-agent-form="pilot-request"/);
  assert.match(pilotForm, /pilot_form_started/);
  assert.match(pilotForm, /pilot_request_submitted/);
  assert.match(webhook, /pilot_payment_completed/);
});

test("thin archives leave the sitemap and operational pages are noindex", () => {
  const sitemap = read("src/app/sitemap.ts");
  const tagPage = read("src/app/blog/tag/[tag]/page.tsx");
  const signIn = read("src/app/sign-in/_page.tsx");
  const signUp = read("src/app/sign-up/_page.tsx");
  const billingSuccess = read("src/app/billing/success/page.tsx");

  assert.doesNotMatch(sitemap, /getAllTags|normalizeTag|\/feed\.xml/);
  assert.match(sitemap, /"\/pilot"/);
  assert.match(tagPage, /noIndex:\s*true/);
  assert.match(signIn, /noIndex:\s*true/);
  assert.match(signUp, /noIndex:\s*true/);
  assert.match(billingSuccess, /noIndex:\s*true/);
});

test("the importer is a free converter with direct pilot and pricing actions", () => {
  const page = read("src/app/import/page.tsx");
  const workbench = read("src/components/import-workbench.tsx");
  assert.match(page, /Free conversational form converter/i);
  assert.match(workbench, /href="\/pilot"/);
  assert.match(workbench, /href="\/pricing"/);
  assert.match(workbench, /Run this with my team/i);
  assert.match(workbench, /Start Pro/i);
});

test("high-intent solution pages embed measured video and commercial actions", () => {
  const solution = read("src/app/solutions/[slug]/page.tsx");
  const video = read("src/components/marketing-video.tsx");
  assert.match(solution, /MarketingVideo/);
  assert.match(solution, /VideoObject/);
  assert.match(solution, /href="\/pilot"/);
  assert.match(solution, /href="\/import"/);
  assert.match(video, /marketing_video_played/);
  assert.match(video, /marketing_video_progress/);
  assert.match(video, /marketing_video_completed/);
});

test("educational detail pages lead qualified readers to the pilot", () => {
  const article = read("src/app/blog/[slug]/page.tsx");
  const useCase = read("src/app/use-cases/[slug]/page.tsx");
  assert.match(article, /href="\/pilot/);
  assert.match(useCase, /href="\/pilot/);
  assert.match(article, /data-agent-action="request-pilot"/);
  assert.match(useCase, /data-agent-action="request-pilot"/);
});

test("commercial terms describe the one-time pilot and payment lifecycle", () => {
  const terms = read("src/app/terms/page.tsx");
  const privacy = read("src/app/privacy/page.tsx");
  assert.match(terms, /one-time guided pilot/i);
  assert.match(terms, /Stripe Checkout/i);
  assert.match(terms, /refund/i);
  assert.match(terms, /not a recurring subscription/i);
  assert.match(privacy, /pilot request/i);
  assert.match(privacy, /business email/i);
});

test("the pilot return page waits for webhook-authoritative confirmation", () => {
  const success = read("src/app/pilot/success/page.tsx");
  assert.match(success, /Confirming your pilot payment/i);
  assert.match(success, /signed webhook/i);
  assert.doesNotMatch(success, /Stripe received the payment/i);
});

test("Clerk middleware is scoped to the two authenticated billing mutations", () => {
  const proxy = read("src/proxy.ts");
  assert.match(proxy, /clerkMiddleware/);
  assert.match(proxy, /\/api\/billing\/checkout/);
  assert.match(proxy, /\/api\/billing\/portal/);
  assert.doesNotMatch(proxy, /\(\?!_next|\/\(api\|trpc\)/);
});
