import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const webRoot = path.resolve(process.cwd(), "apps/web");
const appRoot = path.join(webRoot, "src/app");
const contentRoot = path.join(webRoot, "src/content");

type BlogManifestEntry = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  tags: string[];
  related: string[];
  references: Array<{ title: string; publisher: string; url: string }>;
};

function readJson<T>(file: string): T {
  assert.ok(existsSync(file), `Expected ${path.relative(webRoot, file)} to exist`);
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function wordCount(markdown: string) {
  return markdown
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[`#>*_\[\]()|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function pngDimensions(file: string) {
  const png = readFileSync(file);
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG", `${file} must be a PNG`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test("the blog ships eight substantive, interlinked, referenced articles", () => {
  const manifestFile = path.join(contentRoot, "blog/manifest.json");
  const posts = readJson<BlogManifestEntry[]>(manifestFile);
  const expectedSlugs = [
    "typeform-to-voice-form",
    "google-forms-to-voice-form",
    "voice-forms-accessibility",
    "conversational-lead-qualification",
    "customer-interview-workflow",
    "improve-form-completion",
    "openai-realtime-structured-extraction",
    "audio-form-privacy-security",
  ];

  assert.deepEqual(posts.map((post) => post.slug).sort(), expectedSlugs.sort());
  const validSlugs = new Set(posts.map((post) => post.slug));

  for (const post of posts) {
    assert.ok(post.title.length >= 20, `${post.slug} needs a descriptive title`);
    assert.ok(post.description.length >= 80, `${post.slug} needs a useful description`);
    assert.match(post.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(post.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(post.tags.length >= 2, `${post.slug} needs at least two tags`);
    assert.ok(post.related.length >= 2, `${post.slug} needs at least two related posts`);
    assert.ok(post.related.every((slug) => validSlugs.has(slug) && slug !== post.slug));
    assert.ok(post.references.length >= 5, `${post.slug} needs five authoritative references`);
    assert.ok(
      post.references.every(
        (reference) =>
          reference.title.length > 4 &&
          reference.publisher.length > 2 &&
          /^https:\/\//.test(reference.url),
      ),
      `${post.slug} contains an incomplete reference`,
    );

    const articleFile = path.join(contentRoot, `blog/${post.slug}.md`);
    assert.ok(existsSync(articleFile), `${post.slug}.md is missing`);
    const body = readFileSync(articleFile, "utf8");
    assert.ok(wordCount(body) >= 1200, `${post.slug} has only ${wordCount(body)} words`);
    assert.match(body, /^# /m, `${post.slug} needs an article heading`);
    assert.match(body, /^## /m, `${post.slug} needs scannable sections`);
  }
});

test("blog references do not use sources already verified as missing", () => {
  const deadReferenceUrls = [
    "https://developers.google.com/workspace/forms/api/guides/authorize",
    "https://ico.org.uk/for-organisations/advice-for-small-organisations/how-to-comply-with-uk-data-protection-law/collecting-information-from-people/",
    "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/the-principles/data-minimisation/",
    "https://trailhead.salesforce.com/content/learn/modules/leads_opportunities_lightning_experience/manage-leads",
    "https://www.gov.uk/service-manual/user-research/plan-a-round-of-user-research",
    "https://www.gov.uk/service-manual/user-research/write-a-research-plan",
  ];
  const manifestFile = path.join(contentRoot, "blog/manifest.json");
  const contentCorpus = [
    readFileSync(manifestFile, "utf8"),
    ...readJson<BlogManifestEntry[]>(manifestFile).map((post) =>
      readFileSync(path.join(contentRoot, `blog/${post.slug}.md`), "utf8"),
    ),
  ].join("\n");

  for (const url of deadReferenceUrls) {
    assert.doesNotMatch(contentCorpus, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("content inventories cover eleven use cases and four provider migration guides", () => {
  const useCases = readJson<Array<{ slug: string; title: string; fields: string[]; limitations: string[] }>>(
    path.join(contentRoot, "use-cases.json"),
  );
  const providers = readJson<Array<{ slug: string; name: string; limitations: string[] }>>(
    path.join(contentRoot, "providers.json"),
  );

  assert.equal(useCases.length, 11);
  assert.deepEqual(
    useCases.map((entry) => entry.slug).sort(),
    [
      "agency-briefs",
      "customer-feedback",
      "customer-onboarding",
      "education-intake",
      "job-applications",
      "lead-qualification",
      "product-personalization",
      "project-kickoff",
      "sales-discovery",
      "support-triage",
      "user-research",
    ],
  );
  assert.ok(useCases.every((entry) => entry.fields.length >= 4 && entry.limitations.length >= 2));
  assert.deepEqual(providers.map((entry) => entry.slug).sort(), ["google-forms", "hubspot", "jotform", "typeform"]);
  assert.ok(providers.every((entry) => entry.limitations.length >= 2));
});

test("the use-cases page leads with the completion problem and the three core workflows", () => {
  const page = readFileSync(path.join(appRoot, "use-cases/page.tsx"), "utf8");
  const css = readFileSync(path.join(appRoot, "use-cases/use-cases.module.css"), "utf8");

  assert.match(page, /93,022,997|93 million/i);
  assert.match(page, /Zuko/i);
  assert.match(page, /customer feedback/i);
  assert.match(page, /onboarding/i);
  assert.match(page, /product personalization/i);
  assert.match(page, /structured (?:data|JSON)/i);
  assert.match(page, /MarketingVideo/);
  assert.match(css, /@media \(max-width:/);
  assert.match(css, /prefers-reduced-motion/);
});

test("all public discovery, content, legal, and trust routes exist", () => {
  const routeFiles = [
    "robots.ts",
    "sitemap.ts",
    "feed.xml/route.ts",
    "blog/page.tsx",
    "blog/[slug]/page.tsx",
    "blog/tag/[tag]/page.tsx",
    "use-cases/page.tsx",
    "use-cases/[slug]/page.tsx",
    "import/[provider]/page.tsx",
    "privacy/page.tsx",
    "terms/page.tsx",
    "cookies/page.tsx",
    "security/page.tsx",
    "subprocessors/page.tsx",
    "accessibility/page.tsx",
    "about/page.tsx",
    "contact/page.tsx",
    "pricing/page.tsx",
    "faq/page.tsx",
    "status/page.tsx",
    "changelog/page.tsx",
  ];

  for (const routeFile of routeFiles) {
    assert.ok(existsSync(path.join(appRoot, routeFile)), `${routeFile} is missing`);
  }
});

test("SEO primitives use the canonical www host and expose structured data", () => {
  const layout = readFileSync(path.join(appRoot, "layout.tsx"), "utf8");
  assert.match(layout, /https:\/\/www\.talkform\.ai/);
  assert.match(layout, /application\/ld\+json/);
  assert.match(layout, /Blog/);
  assert.match(layout, /Use Cases/);
  assert.match(layout, /Privacy/);
  assert.match(layout, /support@talkform\.ai/);

  const seoFile = path.join(webRoot, "src/lib/seo.ts");
  assert.ok(existsSync(seoFile), "src/lib/seo.ts is missing");
  const seo = readFileSync(seoFile, "utf8");
  assert.match(seo, /metadataBase/);
  assert.match(seo, /canonical/);
  assert.match(seo, /openGraph/);
  assert.match(seo, /twitter/);

  const robots = readFileSync(path.join(appRoot, "robots.ts"), "utf8");
  const sitemap = readFileSync(path.join(appRoot, "sitemap.ts"), "utf8");
  assert.match(robots, /https:\/\/www\.talkform\.ai\/sitemap\.xml/);
  assert.match(sitemap, /getAllBlogPosts/);
  assert.match(sitemap, /useCases/);
  assert.match(sitemap, /providerImports/);
  assert.doesNotMatch(sitemap, /\/examples\/ai-skill-tutor/);

  assert.deepEqual(pngDimensions(path.join(webRoot, "public/og-image.png")), {
    width: 1200,
    height: 630,
  });
  assert.deepEqual(pngDimensions(path.join(webRoot, "public/apple-icon.png")), {
    width: 180,
    height: 180,
  });
});

test("legal and trust pages use honest support and policy language", () => {
  for (const route of ["privacy", "terms", "cookies", "security", "subprocessors", "accessibility", "contact"] as const) {
    const source = readFileSync(path.join(appRoot, route, "page.tsx"), "utf8");
    assert.match(source, /support@talkform\.ai/, `${route} must name the support contact`);
  }

  const pricing = readFileSync(path.join(appRoot, "pricing/page.tsx"), "utf8");
  const pricingCatalog = readFileSync(path.join(webRoot, "src/lib/pricing.ts"), "utf8");
  assert.match(pricingCatalog, /monthlyPriceUsd:\s*29/);
  assert.match(pricingCatalog, /includedVoiceMinutes:\s*100/);
  assert.match(pricing, /no card is charged/i);

  const cookies = readFileSync(path.join(appRoot, "cookies/page.tsx"), "utf8");
  assert.match(cookies, /talkform_owner/);
  assert.match(cookies, /24 hours/i);
  assert.match(cookies, /HTTP-only/i);
});

test("the homepage does not present unverified speed or conversion lifts as facts", () => {
  const homepage = readFileSync(path.join(appRoot, "page.tsx"), "utf8");
  assert.doesNotMatch(homepage, /Longer\s*[—-]|Shorter\s*[—-]/i);
  assert.doesNotMatch(homepage, /Completion[\s\S]{0,120}(?:Lower|Higher)/i);
  assert.match(homepage, /controlled pilot/i);
  assert.match(homepage, /A\/B test/i);
});
