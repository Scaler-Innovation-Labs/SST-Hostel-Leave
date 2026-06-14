import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Applying migration 0004...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "parent_otp_sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "parent_id" uuid NOT NULL REFERENCES "parents"("id") ON DELETE CASCADE,
      "phone" text NOT NULL,
      "otp_hash" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "verified_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);
  console.log("  - parent_otp_sessions table created");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pos_parent_id_idx" ON "parent_otp_sessions" ("parent_id");
  `);
  console.log("  - parent_id index created");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pos_phone_idx" ON "parent_otp_sessions" ("phone");
  `);
  console.log("  - phone index created");

  console.log("Migration 0004 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
