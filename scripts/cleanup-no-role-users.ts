import * as dotenv from "dotenv";

type NodeEnv = "development" | "staging" | "production";

const envFileMap: Record<NodeEnv, string> = {
  development: ".env.local",
  staging: ".env.staging",
  production: ".env.production",
};

const nodeEnv = (process.env.NODE_ENV ?? "development") as NodeEnv;

dotenv.config({ path: envFileMap[nodeEnv] });

import { eq,sql } from "drizzle-orm";

import { users } from "@/db";
import { db } from "@/lib/db";

async function main() {
  console.log("Checking for users with no roles and no student record...");

  const targetUsers = await db.execute(sql`
    SELECT 
      u.id,
      u.full_name,
      u.email,
      u.clerk_id,
      u.created_at
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN students s ON s.user_id = u.id
    WHERE ur.id IS NULL 
      AND s.id IS NULL
  `);

  console.log(`Found ${targetUsers.rows.length} users with no roles and no student record:`);
  for (const u of targetUsers.rows) {
    console.log(` - ID: ${u.id} | Email: ${u.email} | Name: ${u.full_name}`);
  }

  if (targetUsers.rows.length === 0) {
    console.log("No unassigned users found.");
    return;
  }

  const deletedList: { email: string; name: string; id: string }[] = [];

  for (const u of targetUsers.rows as any[]) {
    try {
      await db.delete(users).where(eq(users.id, u.id));
      deletedList.push({ email: u.email, name: u.full_name, id: u.id });
      console.log(`✓ Deleted user ${u.email} (${u.id})`);
    } catch (err: any) {
      console.warn(`✗ Could not delete ${u.email} (${u.id}):`, err.message);
    }
  }

  console.log(`\nSuccessfully deleted ${deletedList.length} of ${targetUsers.rows.length} dummy/no-role users.`);
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
