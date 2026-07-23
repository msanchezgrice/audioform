import { readFile } from "node:fs/promises";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL is required.");

const migrationUrl = new URL("../../../packages/db/migrations/0001_commercial.sql", import.meta.url);
const migration = await readFile(migrationUrl, "utf8");
const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  await sql.unsafe(migration);
  const [result] = await sql<{
    accounts: string | null;
    checkout_sessions: string | null;
    stripe_events: string | null;
  }[]>`
    select
      to_regclass('public.accounts')::text as accounts,
      to_regclass('public.checkout_sessions')::text as checkout_sessions,
      to_regclass('public.stripe_events')::text as stripe_events
  `;
  if (
    result.accounts !== "accounts" ||
    result.checkout_sessions !== "checkout_sessions" ||
    result.stripe_events !== "stripe_events"
  ) {
    throw new Error("Billing migration verification failed.");
  }
  console.log("Billing schema is ready.");
} finally {
  await sql.end();
}
