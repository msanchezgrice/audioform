import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required.");

  const migrationsUrl = new URL("../../../packages/db/migrations/", import.meta.url);
  const migrationNames = (await readdir(migrationsUrl))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort();
  if (migrationNames.length === 0) throw new Error("No billing migrations were found.");

  const sql = postgres(connectionString, { max: 1, prepare: false });

  try {
    await sql`
      create table if not exists billing_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `;

    for (const name of migrationNames) {
      const migration = await readFile(new URL(name, migrationsUrl), "utf8");
      const checksum = createHash("sha256").update(migration).digest("hex");

      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtext('talkform:billing-migrations'))`;
        const [applied] = await tx<{ checksum: string }[]>`
          select checksum
          from billing_migrations
          where name = ${name}
        `;
        if (applied) {
          if (applied.checksum !== checksum) {
            throw new Error(`Applied billing migration ${name} no longer matches its recorded checksum.`);
          }
          return;
        }

        await tx.unsafe(migration);
        await tx`
          insert into billing_migrations (name, checksum)
          values (${name}, ${checksum})
        `;
      });
    }

    const [result] = await sql<{
      accounts: string | null;
      api_keys: string | null;
      checkout_sessions: string | null;
      entitlements: string | null;
      handoffs: string | null;
      stripe_events: string | null;
      subscriptions: string | null;
      usage_counters: string | null;
    }[]>`
      select
        to_regclass('public.accounts')::text as accounts,
        to_regclass('public.api_keys')::text as api_keys,
        to_regclass('public.checkout_sessions')::text as checkout_sessions,
        to_regclass('public.entitlements')::text as entitlements,
        to_regclass('public.handoffs')::text as handoffs,
        to_regclass('public.stripe_events')::text as stripe_events,
        to_regclass('public.subscriptions')::text as subscriptions,
        to_regclass('public.usage_counters')::text as usage_counters
    `;
    if (
      result.accounts !== "accounts" ||
      result.api_keys !== "api_keys" ||
      result.checkout_sessions !== "checkout_sessions" ||
      result.entitlements !== "entitlements" ||
      result.handoffs !== "handoffs" ||
      result.stripe_events !== "stripe_events" ||
      result.subscriptions !== "subscriptions" ||
      result.usage_counters !== "usage_counters"
    ) {
      throw new Error("Billing migration verification failed.");
    }
    console.log("Billing schema is ready.");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
