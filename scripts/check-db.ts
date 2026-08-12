/**
 * Read-only database diagnostic.
 *
 * Prints the `user_roles` columns (to confirm migration 0008 is applied) and
 * row counts for the main tables. Useful when a page renders empty dropdowns
 * or lists on one environment but not another (e.g. local vs Vercel).
 *
 * Usage:
 *   pnpm tsx scripts/check-db.ts                      # uses DATABASE_URL from env
 *   DATABASE_URL="postgresql://..." pnpm tsx scripts/check-db.ts
 */
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });

async function main() {
  const raw = process.env.DATABASE_URL;

  if (!raw) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const url = new URL(raw);
  // The Neon pooler rejects channel_binding via TCP drivers; strip it.
  url.searchParams.delete("channel_binding");
  url.searchParams.set("connect_timeout", "15");

  const client = new Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 20000,
  });

  await client.connect();
  console.log("host:", url.host, "| database:", url.pathname.replace(/^\//, ""));

  const cols = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_roles' ORDER BY ordinal_position",
  );
  const columnNames = cols.rows.map((r) => r.column_name as string);
  console.log("user_roles columns:", columnNames.join(", "));
  console.log(
    "migration 0008 (role scopes) applied:",
    columnNames.includes("scope_type") && columnNames.includes("scope_id") ? "YES" : "NO",
  );

  for (const table of ["hostels", "academic_groups", "students", "users", "leave_requests"]) {
    const res = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
    console.log(`  ${table}: ${res.rows[0]?.n ?? 0}`);
  }

  await client.end();
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});
