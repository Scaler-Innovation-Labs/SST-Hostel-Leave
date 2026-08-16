import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0023 (rate_limit_entries)...");

  // The old in-memory rate limiter was per-serverless-instance and therefore
  // a no-op across Vercel invocations. The limit counters now live here so
  // the parent-approve decision endpoint (and any future limiter) holds
  // across instances.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "rate_limit_entries" (
      "key" text PRIMARY KEY NOT NULL,
      "count" integer NOT NULL DEFAULT 0,
      "reset_at" timestamp with time zone NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);
  console.log("  - rate_limit_entries table created");

  console.log("Migration 0023 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
