import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Renames the three leave types (+ their workflow definitions) in the LIVE DB
 * to match the updated seed copy:
 *
 *   RE_EXAM             "Re Exam"                    → "Warden Approval for Re Exam"
 *   LONG_LEAVE          "Long Leave"                 → "General Leave"
 *   MARRIAGE_BEREAVEMENT "Marriage / Relative Expired" → "Warden Approval for Attendance Exemption"
 *
 * The seed uses onConflictDoNothing, so existing rows keep their old names —
 * this script brings the live DB in sync.
 *
 * Usage:
 *   npx tsx scripts/rename-leave-types.ts
 */
const RENAMES = [
  {
    code: "RE_EXAM",
    leaveTypeName: "Warden Approval for Re Exam",
    workflowName: "Warden Approval for Re Exam Workflow",
  },
  {
    code: "LONG_LEAVE",
    leaveTypeName: "General Leave",
    workflowName: "General Leave Workflow",
  },
  {
    code: "MARRIAGE_BEREAVEMENT",
    leaveTypeName: "Warden Approval for Attendance Exemption",
    workflowName: "Warden Approval for Attendance Exemption Workflow",
  },
];

async function main() {
  const { db } = await import("@/lib/db");
  const { leaveTypes, workflowDefinitions } = await import("@/db");
  const { eq } = await import("drizzle-orm");

  console.log("Renaming leave types + workflows in the live DB...\n");

  for (const rename of RENAMES) {
    const lt = await db
      .update(leaveTypes)
      .set({ name: rename.leaveTypeName })
      .where(eq(leaveTypes.code, rename.code))
      .returning({ id: leaveTypes.id, code: leaveTypes.code, name: leaveTypes.name });

    const wf = await db
      .update(workflowDefinitions)
      .set({ name: rename.workflowName })
      .where(eq(workflowDefinitions.code, rename.code))
      .returning({ id: workflowDefinitions.id, code: workflowDefinitions.code, name: workflowDefinitions.name });

    console.log(`  ${rename.code}:`);
    console.log(`    leave type  → ${lt[0] ? `${lt[0].name} (${lt[0].id})` : "NOT FOUND"}`);
    console.log(`    workflow    → ${wf[0] ? `${wf[0].name} (${wf[0].id})` : "NOT FOUND"}`);
  }

  console.log("\n✅ Done.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
