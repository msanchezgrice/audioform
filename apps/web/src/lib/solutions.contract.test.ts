import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const webRoot = path.resolve(process.cwd(), "apps/web");
const appRoot = path.join(webRoot, "src/app");

type Solution = {
  slug: string;
  query: string;
  title: string;
  description: string;
  templateId: string;
  definition: string;
  bestFor: string[];
  workflow: string[];
  tradeoffs: string[];
  questions: Array<{ question: string; answer: string }>;
};

function read(relativePath: string) {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

function readSolutions() {
  return JSON.parse(read("src/content/solutions.json")) as Solution[];
}

test("ships four useful, non-overlapping query solution pages", () => {
  const solutions = readSolutions();

  assert.deepEqual(
    solutions.map((solution) => solution.slug),
    ["voice-form", "conversational-forms", "chat-form", "voice-survey"],
  );
  assert.deepEqual(
    solutions.map((solution) => solution.query),
    ["voice form", "conversational forms", "chat form", "voice survey"],
  );

  for (const solution of solutions) {
    assert.ok(solution.title.toLowerCase().includes(solution.query), `${solution.slug} title must match its query`);
    assert.ok(solution.description.length >= 110, `${solution.slug} needs a useful search description`);
    assert.ok(solution.definition.length >= 180, `${solution.slug} needs a substantive definition`);
    assert.ok(solution.bestFor.length >= 3, `${solution.slug} needs concrete fit guidance`);
    assert.ok(solution.workflow.length >= 4, `${solution.slug} needs an actionable workflow`);
    assert.ok(solution.tradeoffs.length >= 3, `${solution.slug} needs honest tradeoffs`);
    assert.ok(solution.questions.length >= 3, `${solution.slug} needs answerable FAQs`);

    const corpus = JSON.stringify(solution);
    assert.doesNotMatch(corpus, /(?:increase|improve|boost).{0,35}(?:conversion|completion).{0,20}\d+%/i);
    assert.match(corpus, /review|browser|text|voice/i);
  }
});

test("solution routes publish canonical metadata, indexable schema, and internal discovery", () => {
  const route = read("src/app/solutions/[slug]/page.tsx");
  const index = read("src/app/solutions/page.tsx");
  const sitemap = read("src/app/sitemap.ts");
  const layout = read("src/app/layout.tsx");

  assert.ok(existsSync(path.join(appRoot, "solutions/[slug]/page.tsx")));
  assert.match(route, /createMetadata/);
  assert.match(route, /path:\s*`\/solutions\/\$\{solution\.slug\}`/);
  assert.match(route, /FAQPage/);
  assert.match(route, /WebPage/);
  assert.match(route, /generateStaticParams/);
  assert.match(index, /CollectionPage/);
  assert.match(sitemap, /solutions\.map/);
  assert.match(sitemap, /\/solutions/);
  assert.match(layout, /href:\s*"\/solutions"/);
});

test("each solution has a measured direct path into a matching safe demo", () => {
  const cta = read("src/components/solution-cta.tsx");
  const appPage = read("src/app/app/page.tsx");
  const gallery = read("src/components/demo-template-gallery.tsx");

  assert.match(cta, /emitTalkformEvent\("conversion_clicked"/);
  assert.match(cta, /useCaseId/);
  assert.match(cta, /destination/);
  assert.match(cta, /`\/app\?template=\$\{templateId\}`/);
  assert.match(appPage, /searchParams/);
  assert.match(appPage, /getAudioformTemplate/);
  assert.match(appPage, /voiceEnabled=\{process\.env\.TALKFORM_ENABLE_PUBLIC_REALTIME === "true"\}/);
  assert.match(gallery, /initialTemplateId/);

  for (const solution of readSolutions()) {
    assert.match(appPage, /AUDIOFORM_TEMPLATES/);
    assert.match(JSON.stringify(solution), new RegExp(`"templateId":"${solution.templateId}"`));
  }
});
