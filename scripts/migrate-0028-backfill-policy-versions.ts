import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Policy versioning was introduced after the policies seed, which inserts
// rows directly and therefore never snapshotted a version. At runtime the
// policy engine resolves an immutable version for every active policy, so a
// policy without a version makes leave submission fail with a missing
// PolicyVersion. Snapshot v1 for every policy that has none.
//
// Mirrors leave-types.seed.ts and workflows.seed.ts, which backfill the same
// way for their respective configuration tables.

async function main() {
  const { db } = await import("@/lib/db");
  const { policies } = await import("@/db/schema/policy");
  const { policyVersionRepository } = await import(
    "@/db/repositories/policy/policy-version.repository"
  );
  const { policyVersionService } = await import(
    "@/services/policy/policy-version.service"
  );

  console.log("Applying migration 0028 (backfill policy versions)...");

  const allPolicies = await db.select({ id: policies.id }).from(policies);

  let backfilled = 0;
  for (const policy of allPolicies) {
    const existing = await policyVersionRepository.findLatestByPolicyId(
      policy.id,
      db
    );
    if (existing) continue;

    await policyVersionService.createVersion(policy.id, null, db);
    console.log(`  [backfill] policy ${policy.id} -> v1`);
    backfilled++;
  }

  console.log(`  - backfilled ${backfilled} policy version(s)`);
  console.log("Migration 0028 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
