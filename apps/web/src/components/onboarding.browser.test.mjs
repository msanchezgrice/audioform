import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const baseUrl = process.env.TALKFORM_BASE_URL ?? "http://localhost:3107";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const workspaceRoot = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));
const canLaunch = existsSync(executablePath);
const browserTestOptions = canLaunch || process.env.CI ? {} : { skip: "Chrome is unavailable locally" };
let ownedServer;

if (process.env.CI && !canLaunch) {
  throw new Error(`Chrome executable not found at ${executablePath}`);
}

function requireBrowser() {
  if (!canLaunch) {
    throw new Error(`Chrome executable not found at ${executablePath}`);
  }
}

function captureRuntimeErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()} (${message.location().url})`);
  });
  return errors;
}

async function serverIsReady() {
  try {
    const response = await fetch(`${baseUrl}/app`, {
      signal: AbortSignal.timeout(1_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

before(async () => {
  if (!canLaunch) return;
  if (process.env.TALKFORM_BASE_URL || await serverIsReady()) return;

  ownedServer = spawn(
    "pnpm",
    ["--filter", "@talkform/web", "exec", "next", "start", "-p", "3107"],
    {
      cwd: workspaceRoot,
      detached: process.platform !== "win32",
      stdio: "ignore",
    },
  );

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (ownedServer.exitCode !== null) {
      throw new Error(`Talkform test server exited with code ${ownedServer.exitCode}`);
    }
    if (await serverIsReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Talkform test server did not become ready at ${baseUrl}`);
}, { timeout: 35_000 });

after(() => {
  if (!ownedServer?.pid || ownedServer.exitCode !== null) return;
  if (process.platform === "win32") {
    ownedServer.kill("SIGTERM");
    return;
  }
  try {
    process.kill(-ownedServer.pid, "SIGTERM");
  } catch {
    ownedServer.kill("SIGTERM");
  }
});

test("local text onboarding completes without AI requests and sends only bounded completion metadata", browserTestOptions, async () => {
  requireBrowser();
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const apiRequests = [];
  const runtimeErrors = captureRuntimeErrors(page);
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push({ path: new URL(request.url()).pathname, method: request.method(), body: request.postData() });
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.__talkformEvents = [];
      window.addEventListener("talkform:event", (event) => {
        window.__talkformEvents.push(event.detail);
      });
    });
    apiRequests.length = 0;

    const typingChoice = page.getByRole("button", { name: "Continue with typing" });
    await typingChoice.waitFor({ state: "visible" });
    assert.equal(await typingChoice.isVisible(), true);
    await typingChoice.click();
    await page.getByText("Typing", { exact: true }).waitFor();

    const completionBeacon = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/analytics/interview-completion");
    const answers = ["Miguel", "Onboarding", "5", "The setup took too long", "No"];
    for (let index = 0; index < answers.length; index += 1) {
      const input = page.getByLabel("Type your answer");
      await input.fill(answers[index]);
      await input.press("Enter");
      await page.getByText(`${index + 1} of 5`, { exact: true }).waitFor();
    }

    await page.getByRole("heading", { name: "Your answers are ready" }).waitFor();
    await completionBeacon;
    assert.equal(apiRequests.length, 1, "Text completion should send only its coarse completion beacon");
    assert.equal(apiRequests[0].path, "/api/analytics/interview-completion");
    assert.equal(apiRequests[0].method, "POST");
    const completionMetadata = JSON.parse(apiRequests[0].body);
    assert.deepEqual(Object.keys(completionMetadata).sort(), ["captured", "formId", "mode", "percent", "required"]);
    assert.equal(completionMetadata.mode, "text");
    assert.equal(completionMetadata.captured, 5);
    assert.equal(completionMetadata.percent, 100);
    assert.ok(Number.isInteger(completionMetadata.required) && completionMetadata.required > 0 && completionMetadata.required <= 5);
    assert.match(completionMetadata.formId, /^[a-z0-9][a-z0-9_-]{0,79}$/);
    assert.doesNotMatch(apiRequests[0].body, /Miguel|setup took|Onboarding|transcript|summary|sessionId/i);

    const customerName = page.getByLabel("Edit Customer name");
    await customerName.fill("Miguel C.");
    assert.equal(await customerName.inputValue(), "Miguel C.");

    const events = await page.evaluate(() => window.__talkformEvents);
    const eventNames = events.map((entry) => entry.event);
    assert.ok(eventNames.includes("interview_mode_selected"));
    assert.ok(eventNames.includes("first_answer_captured"));
    assert.ok(eventNames.includes("interview_completed"));
    const serializedEvents = JSON.stringify(events);
    assert.doesNotMatch(serializedEvents, /Miguel|setup took|Onboarding/i);
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await browser.close();
  }
});

test("mobile onboarding choices remain visible and app/embed pages do not overflow", browserTestOptions, async () => {
  requireBrowser();
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const runtimeErrors = captureRuntimeErrors(page);

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
    const typingChoice = page.getByRole("button", { name: "Continue with typing" });
    const choiceBox = await typingChoice.boundingBox();
    assert.ok(choiceBox, "typing choice should be visible");
    await page.screenshot({ path: "/tmp/talkform-onboarding-mobile.png", fullPage: true });
    assert.ok(
      choiceBox.y + choiceBox.height <= 812,
      `onboarding choices should fit in the first mobile viewport (bottom=${choiceBox.y + choiceBox.height})`,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      "/app should not overflow horizontally",
    );
    await page.goto(`${baseUrl}/embed`, { waitUntil: "domcontentloaded" });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      "/embed should not overflow horizontally",
    );
    await page.screenshot({ path: "/tmp/talkform-embed-mobile.png", fullPage: true });
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await browser.close();
  }
});

test("homepage hero stacks cleanly on mobile and stays balanced on desktop", browserTestOptions, async () => {
  requireBrowser();
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const mobile = await page.evaluate(() => {
      const hero = document.querySelector("main > section");
      const article = hero?.querySelector("article");
      const aside = hero?.querySelector("aside");
      const heading = article?.querySelector("h1");
      const rect = (element) => {
        const value = element?.getBoundingClientRect();
        return value ? { top: value.top, bottom: value.bottom, left: value.left, right: value.right, width: value.width, height: value.height } : null;
      };
      return { hero: rect(hero), article: rect(article), aside: rect(aside), heading: rect(heading), scrollWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth };
    });
    assert.ok(mobile.hero && mobile.article && mobile.aside && mobile.heading, "homepage hero elements should render");
    assert.ok(mobile.heading.width >= 250, `mobile heading should have useful width (width=${mobile.heading.width})`);
    assert.ok(mobile.aside.top >= mobile.article.bottom - 1, "mobile setup panel should follow the headline instead of overlapping it");
    assert.ok(mobile.aside.left >= mobile.article.left - 1 && mobile.aside.right <= mobile.article.right + 1, "mobile setup panel should align within the headline column");
    assert.equal(mobile.scrollWidth <= mobile.viewportWidth, true, "homepage should not overflow horizontally on mobile");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });
    const desktop = await page.evaluate(() => {
      const hero = document.querySelector("main > section");
      const article = hero?.querySelector("article");
      const aside = hero?.querySelector("aside");
      const rect = (element) => {
        const value = element?.getBoundingClientRect();
        return value ? { top: value.top, bottom: value.bottom, left: value.left, right: value.right, width: value.width, height: value.height } : null;
      };
      return { hero: rect(hero), article: rect(article), aside: rect(aside), scrollWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth };
    });
    assert.ok(desktop.hero && desktop.article && desktop.aside, "desktop hero elements should render");
    assert.ok(desktop.aside.left > desktop.article.right, "desktop setup panel should sit beside the headline");
    assert.equal(desktop.scrollWidth <= desktop.viewportWidth, true, "homepage should not overflow horizontally on desktop");
  } finally {
    await browser.close();
  }
});
