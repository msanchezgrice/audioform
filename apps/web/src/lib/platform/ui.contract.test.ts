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
  assert.doesNotMatch(respondent, /token\.current/);
  assert.doesNotMatch(respondent, /[?&]token=/);
  assert.ok(
    respondent.indexOf("if (error)") < respondent.indexOf("if (submitted)"),
    "a failed load must take precedence over a prior completed state",
  );
});

test("respondent route explicitly loads the published widget stylesheet", () => {
  const nextConfig = read("next.config.ts");
  const respondent = read("src/app/respond/[id]/respondent-interview.tsx");
  const widget = read("../../packages/react/src/AudioformWidget.tsx");
  assert.match(nextConfig, /transpilePackages:[\s\S]*@talkform\/react/);
  assert.match(respondent, /import ["']@talkform\/react\/styles\.css["']/);
  assert.match(widget, /AudioformWidget\.module\.css/);
});
