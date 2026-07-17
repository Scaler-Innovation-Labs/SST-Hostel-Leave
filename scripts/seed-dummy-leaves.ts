/**
 * Seeds dummy leave requests with approvals for testing the approvals page.
 *
 * Usage:
 *   npx tsx scripts/seed-dummy-leaves.ts
 */

import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import {
  leaveApprovals,
  leaveRequests,
  leaveTypes,
  roles,
  students,
  users,
  workflowDefinitions,
  workflowSteps,
} from "@/db";
import { db } from "@/lib/db";

async function main() {
  console.log("Seeding dummy leaves...\n");

  // ── Fetch reference data ──

  const studentRow = await db
    .select({ id: students.id, userId: students.userId })
    .from(students)
    .limit(1);

  if (studentRow.length === 0) {
    console.error("No student found. Run the main seed first.");
    process.exit(1);
  }

  const studentId = studentRow[0]!.id;
  const studentUserId = studentRow[0]!.userId;

  const userRow = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, studentUserId))
    .limit(1);

  const studentName = userRow[0]?.fullName ?? "Test Student";
  console.log(`  Student: ${studentName} (${studentId})`);

  // Fetch all leave types
  const allLeaveTypes = await db.select().from(leaveTypes);
  if (allLeaveTypes.length === 0) {
    console.error("No leave types found.");
    process.exit(1);
  }

  const leaveTypeMap = new Map(allLeaveTypes.map((lt) => [lt.code, lt]));
  console.log(`  Leave types: ${allLeaveTypes.map((lt) => lt.code).join(", ")}`);

  // Fetch roles
  const allRoles = await db.select().from(roles);
  const roleMap = new Map(allRoles.map((r) => [r.code, r.id]));

  // Fetch all workflow definitions
  const workflows = await db.select().from(workflowDefinitions);
  console.log(`  Workflows: ${workflows.map((w) => w.code).join(", ")}`);

  // Fetch all workflow steps
  const allSteps = await db.select().from(workflowSteps);
  console.log(`  Workflow steps: ${allSteps.length} total\n`);

  // ── Helper to create a leave + approvals ──
  async function createLeaveWithApprovals(
    leaveTypeCode: string,
    status: string,
    currentStepKey: string | null,
    currentStepOrder: number | null,
    approvals: Array<{
      stepKey: string;
      stepOrder: number;
      decision: string;
      approverRoleId: string | null;
    }>,
    daysAgo: number,
  ) {
    const leaveType = leaveTypeMap.get(leaveTypeCode);
    if (!leaveType) {
      console.warn(`  Skip leave type "${leaveTypeCode}" — not found`);
      return;
    }

    const now = new Date();
    const startAt = new Date(now);
    startAt.setDate(startAt.getDate() + 1); // tomorrow
    const endAt = new Date(startAt);
    endAt.setDate(endAt.getDate() + 2); // 2 days later

    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - daysAgo);

    const requestNumber = `LR-DUMMY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const insertedLeaves = await db
      .insert(leaveRequests)
      .values({
        requestNumber,
        studentId,
        leaveTypeId: leaveType.id,
        reason: `Dummy leave request for testing — ${leaveType.name} (${status})`,
        status: status as any,
        currentStepKey,
        currentStepOrder,
        startAt,
        endAt,
        submittedForm: {},
        policyResult: { allowed: true, checks: [] },
        submittedAt: createdAt,
        createdAt,
      })
      .returning();

    const leave = insertedLeaves[0]!;
    console.log(`  Created leave: ${requestNumber} (${leaveType.code}, ${status})`);

    // Create approvals
    for (const app of approvals) {
      await db.insert(leaveApprovals).values({
        leaveRequestId: leave.id,
        stepKey: app.stepKey,
        stepOrder: app.stepOrder,
        approverRoleId: app.approverRoleId,
        decision: app.decision as any,
        approvalSource: LEAVE_APPROVAL_SOURCE.WEB,
        actedAt: app.decision !== LEAVE_APPROVAL_DECISION.PENDING ? new Date() : null,
        createdAt,
      });
    }

    console.log(`    → ${approvals.length} approval(s) created`);
  }

  // ── Helper to get role ID ──
  const getRoleId = (code: string) => roleMap.get(code) ?? null;

  // ================================================================
  // CREATE DUMMY LEAVES
  // ================================================================

  // 1. Home Pass — Pending at POC step (waiting on hostel approval)
  await createLeaveWithApprovals(
    "HOME_PASS",
    LEAVE_REQUEST_STATUS.PENDING,
    WORKFLOW_STEP_KEY.POC_APPROVAL,
    1,
    [
      {
        stepKey: WORKFLOW_STEP_KEY.POC_APPROVAL,
        stepOrder: 1,
        decision: LEAVE_APPROVAL_DECISION.PENDING,
        approverRoleId: getRoleId("POC"),
      },
    ],
    0, // created today
  );

  // 2. Home Pass Extended — Waiting on ADMIN (POC already approved)
  const pocRoleId = getRoleId("POC");
  const adminRoleId = getRoleId("ADMIN");
  await createLeaveWithApprovals(
    "HOME_PASS",
    LEAVE_REQUEST_STATUS.PENDING,
    WORKFLOW_STEP_KEY.ADMIN_APPROVAL,
    2,
    [
      {
        stepKey: WORKFLOW_STEP_KEY.POC_APPROVAL,
        stepOrder: 1,
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        approverRoleId: pocRoleId,
      },
      {
        stepKey: WORKFLOW_STEP_KEY.ADMIN_APPROVAL,
        stepOrder: 2,
        decision: LEAVE_APPROVAL_DECISION.PENDING,
        approverRoleId: adminRoleId,
      },
    ],
    1, // created yesterday
  );

  // 3. Local Outing — Approved (all steps completed)
  await createLeaveWithApprovals(
    "LOCAL_OUTING",
    LEAVE_REQUEST_STATUS.APPROVED,
    null,
    null,
    [
      {
        stepKey: WORKFLOW_STEP_KEY.POC_APPROVAL,
        stepOrder: 1,
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        approverRoleId: pocRoleId,
      },
    ],
    2,
  );

  // 4. Night Out — Rejected at POC step
  await createLeaveWithApprovals(
    "NIGHT_OUT",
    LEAVE_REQUEST_STATUS.REJECTED,
    null,
    null,
    [
      {
        stepKey: WORKFLOW_STEP_KEY.POC_APPROVAL,
        stepOrder: 1,
        decision: LEAVE_APPROVAL_DECISION.REJECTED,
        approverRoleId: pocRoleId,
      },
    ],
    3,
  );

  // 5. Night Out — Pending at ADMIN step (POC approved)
  await createLeaveWithApprovals(
    "NIGHT_OUT",
    LEAVE_REQUEST_STATUS.PENDING,
    WORKFLOW_STEP_KEY.ADMIN_APPROVAL,
    2,
    [
      {
        stepKey: WORKFLOW_STEP_KEY.POC_APPROVAL,
        stepOrder: 1,
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        approverRoleId: pocRoleId,
      },
      {
        stepKey: WORKFLOW_STEP_KEY.ADMIN_APPROVAL,
        stepOrder: 2,
        decision: LEAVE_APPROVAL_DECISION.PENDING,
        approverRoleId: adminRoleId,
      },
    ],
    0,
  );

  // 6. Medical Leave — Pending at PARENT step
  await createLeaveWithApprovals(
    "MEDICAL",
    LEAVE_REQUEST_STATUS.PENDING,
    WORKFLOW_STEP_KEY.PARENT_APPROVAL,
    1,
    [
      {
        stepKey: WORKFLOW_STEP_KEY.PARENT_APPROVAL,
        stepOrder: 1,
        decision: LEAVE_APPROVAL_DECISION.PENDING,
        approverRoleId: null, // parent approval
      },
      {
        stepKey: WORKFLOW_STEP_KEY.POC_APPROVAL,
        stepOrder: 2,
        decision: LEAVE_APPROVAL_DECISION.PENDING,
        approverRoleId: pocRoleId,
      },
      {
        stepKey: WORKFLOW_STEP_KEY.ADMIN_APPROVAL,
        stepOrder: 3,
        decision: LEAVE_APPROVAL_DECISION.PENDING,
        approverRoleId: adminRoleId,
      },
    ],
    0,
  );

  // 7. Medical Leave — Pending at ADMIN step (parent + POC approved)
  await createLeaveWithApprovals(
    "MEDICAL",
    LEAVE_REQUEST_STATUS.PENDING,
    WORKFLOW_STEP_KEY.ADMIN_APPROVAL,
    3,
    [
      {
        stepKey: WORKFLOW_STEP_KEY.PARENT_APPROVAL,
        stepOrder: 1,
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        approverRoleId: null,
      },
      {
        stepKey: WORKFLOW_STEP_KEY.POC_APPROVAL,
        stepOrder: 2,
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        approverRoleId: pocRoleId,
      },
      {
        stepKey: WORKFLOW_STEP_KEY.ADMIN_APPROVAL,
        stepOrder: 3,
        decision: LEAVE_APPROVAL_DECISION.PENDING,
        approverRoleId: adminRoleId,
      },
    ],
    1,
  );

  console.log("\n✅ Done! 7 dummy leaves created with various statuses and approval states.");
}

main()
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  })
  .finally(() => process.exit());
