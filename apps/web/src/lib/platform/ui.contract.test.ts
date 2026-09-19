import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const webRoot = path.resolve(process.cwd(), "apps/web");
const read = (relativePath: string) => readFileSync(path.join(webRoot, relativePath), "utf8");

test("project dashboard links to the published hosted HTTP guide", () => {
  const dashboard = read("src/app/dashboard/project-dashboard.tsx");
  assert.match(dashboard, /href="\/docs\/http-api"/);
  assert.doesNotMatch(dashboard, /href="\/docs\/http"/);
});

test("respondent UI keeps its bearer token in a request header and submits reviewed values", () => {
  const respondent = read("src/app/respond/[id]/respondent-interview.tsx");
  assert.match(respondent, /X-Talkform-Respondent-Token/);
  assert.match(respondent, /values: result\.fields/);
  assert.match(respondent, /data\.status === "completed"/);
  assert.match(respondent, /respondentToken/);
  assert.match(respondent, /fromName/);
  assert.match(respondent, /respond\.module\.css/);
  assert.doesNotMatch(respondent, /workspace\.module\.css/);
  assert.doesNotMatch(respondent, /token\.current/);
  assert.doesNotMatch(respondent, /[?&]token=/);
  assert.ok(
    respondent.indexOf("if (error)") < respondent.indexOf("if (submitted)"),
    "a failed load must take precedence over a prior completed state",
  );
});

test("site chrome hides marketing header and Twelve Tools on respondent routes", () => {
  const frame = read("src/components/workspace-navigation.tsx");
  const css = read("src/app/globals.css");
  const layout = read("src/app/layout.tsx");
  assert.match(frame, /respondentShell/);
  assert.match(css, /respondent-route \.siteHeader/);
  assert.match(css, /respondent-route \.siteFooter/);
  assert.match(layout, /respondent-route/);
  assert.match(layout, /twelve\.tools/);
});

test("respondent page applies product theme vars and is honest about text-only voice", () => {
  const respondent = read("src/app/respond/[id]/respondent-interview.tsx");
  const css = read("src/app/respond/[id]/respond.module.css");
  assert.match(respondent, /--respond-accent/);
  assert.match(respondent, /--respond-surface/);
  assert.match(respondent, /--respond-panel/);
  assert.match(respondent, /resolveEffectiveInterviewMode/);
  const page = read("src/app/respond/[id]/page.tsx");
  assert.match(page, /publicRealtimeIssuanceEnabled/);
  assert.match(respondent, /referrerPolicy="no-referrer"/);
  assert.match(respondent, /This is a written interview/);
  assert.match(respondent, /You can speak or type/);
  assert.match(respondent, /\/api\/v1\/respond\/\$\{id\}\/parse/);
  assert.match(respondent, /applyFavicon/);
  assert.match(css, /--respond-surface/);
  assert.match(css, /--respond-accent/);
});

test("respondent route explicitly loads the published widget stylesheet", () => {
  const nextConfig = read("next.config.ts");
  const respondent = read("src/app/respond/[id]/respondent-interview.tsx");
  const widget = read("../../packages/react/src/AudioformWidget.tsx");
  assert.match(nextConfig, /transpilePackages:[\s\S]*@talkform\/react/);
  assert.match(respondent, /import ["']@talkform\/react\/styles\.css["']/);
  assert.match(widget, /AudioformWidget\.module\.css/);
});
