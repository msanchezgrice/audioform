import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
// The database secret remains inside the existing Vercel production environment.
// Preview builds never mutate the production schema.
async function main() {
if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_URL || !process.env.TALKFORM_DATA_ENCRYPTION_KEY) {
    throw new Error("The production platform database and encryption key must be configured before release.");
  }
  if (Buffer.from(process.env.TALKFORM_DATA_ENCRYPTION_KEY, "base64").length !== 32) throw new Error("Invalid platform encryption key.");
  const migration = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./migrate-billing.ts", import.meta.url))], { stdio: "inherit" });
  if (migration.status !== 0) throw new Error("Production migration failed.");
} else {
  console.log("Skipping production database migration outside Vercel production.");
}
}
void main().catch(() => { console.error("Production schema preparation failed."); process.exitCode = 1; });
