import { writeFile } from "node:fs/promises";
import { createProject, createProjectApiKey } from "../src/lib/platform/projects";
import { authenticateProjectKey } from "../src/lib/platform/auth";
import { createHandoff } from "../src/lib/platform/handoffs";
import { platformDatabase } from "../src/lib/platform/database";

async function main() {
  const database = new URL(process.env.DATABASE_URL || "");
  if (!["localhost", "127.0.0.1"].includes(database.hostname)) throw new Error("This fixture only runs against a local test database.");
  const userId = `user_local_release_${Date.now()}`;
  const project = await createProject(userId, { name: "Local release verification", environment: "test" });
  const key = await createProjectApiKey(userId, project.id, { name: "Local HTTP test" });
  const principal = await authenticateProjectKey(new Request("http://localhost:48173", { headers: { Authorization: `Bearer ${key.secret}` } }), "handoffs:write");
  const config = { id: "release-check", title: "Plan a useful workshop", fields: [
    { id: "goal", type: "text" as const, label: "Workshop goal", required: true, promptTitle: "What should the workshop accomplish?", promptDetail: "Ask for one practical outcome." },
    { id: "people", type: "number" as const, label: "Number of people (optional)", required: false, promptTitle: "How many people will join?", promptDetail: "An estimate is fine." },
  ] };
  const handoff = await createHandoff(principal, { config, idempotencyKey: "local-browser-verification", baseUrl: "http://localhost:48173" });
  await writeFile("/private/tmp/talkform-browser-fixture.json", JSON.stringify({ project, key: key.secret, handoff, config }), { mode: 0o600 });
  console.log("Local browser fixture created. Secrets retained only in the local test fixture file.");
  await platformDatabase().end();
}
void main().catch(() => { console.error("Local fixture creation failed."); process.exitCode = 1; });
