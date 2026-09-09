import postgres from "postgres";
declare global { var talkformPlatformSql: ReturnType<typeof postgres> | undefined; }
export function platformDatabase() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required for the Talkform platform API.");
  if (!globalThis.talkformPlatformSql) globalThis.talkformPlatformSql = postgres(connectionString, { max: 8, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  return globalThis.talkformPlatformSql;
}
