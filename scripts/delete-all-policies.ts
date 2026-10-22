import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Ops script: remove every policy and its immutable configuration history.
//
// Deletion order is dictated by foreign keys:
//   policy_evaluations.policy_version_id -> policy_versions (ON DELETE RESTRICT)
//   policy_versions.policy_id            -> policies         (ON DELETE RESTRICT)
//   policy_evaluations.policy_id         -> policies         (ON DELETE SET NULL)
//
// So: detach evaluations from their versions, drop the versions, then the
// policies. policy_evaluations rows themselves are historical facts about
// past leaves and are preserved (only their policy references are cleared).

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Deleting all policies...");

  await db.transaction(async (tx) => {
    const detached = await tx.execute(sql`
      UPDATE policy_evaluations
      SET policy_version_id = NULL
      WHERE policy_version_id IS NOT NULL;
    `);
    console.log(`  - detached ${detached.rowCount ?? 0} policy evaluation(s) from versions`);

    const versions = await tx.execute(sql`DELETE FROM policy_versions;`);
    console.log(`  - deleted ${versions.rowCount ?? 0} policy version(s)`);

    const policies = await tx.execute(sql`DELETE FROM policies;`);
    console.log(`  - deleted ${policies.rowCount ?? 0} policy(ies)`);
  });

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error("Delete failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
