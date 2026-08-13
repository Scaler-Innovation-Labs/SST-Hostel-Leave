/**
 * Seeds a few dummy leave requests parked at the POC approval step and
 * ASSIGNED to the POC user(s) present in the database.
 *
 * Why this exists: `seed-all-leave-types.ts` creates the full stage matrix
 * with `approverRoleId` set but never `approverUserId`. The POC approvals
 * queue filters by `approverUserId = currentUser.id`
 * (see `list-approvals.service.ts`), so those rows never surface in a POC's
 * queue. This script fills that gap:
 *
 *   - finds every user holding the POC role
 *   - picks students from that POC's scoped hostels (all hostels when the
 *     POC is unscoped)
 *   - creates one pending leave per leave type that has a POC_APPROVAL
 *     workflow step, with the POC-step approval row carrying that POC user
 *     as `approverUserId` and earlier steps already approved
 *
 * Idempotent: existing leaves with requestNumber prefix `LR-POC-` are
 * deleted (cascade removes their approvals) and re-created.
 *
 * Usage:
 *   npx tsx scripts/seed-poc-tickets.ts
 */

import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { randomUUID } from "node:crypto";

import { eq, inArray, like } from "drizzle-orm";

import { ROLE_SCOPE_TYPE } from "@/constants/auth/role-scope";
import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import {
  hostels,
  leaveApprovals,
  leaveRequests,
  leaveTypes,
  parents,
  roles,
  students,
  userRoles,
  users,
  workflowSteps,
} from "@/db";
import { ROLES } from "@/lib/auth/roles";
import { db } from "@/lib/db";

type WorkflowStepRow = {
  stepKey: string;
  stepOrder: number;
  approverRoleId: string | null;
  isParentApproval: boolean;
};

function buildSubmittedForm(leaveTypeCode: string): Record<string, unknown> {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  switch (leaveTypeCode) {
    case "LATE_STAY_COLLEGE":
      return { reason: "Project submission in lab" };
    case "INTERNSHIP":
      return {
        company: "TechCorp",
        companyAddress: "HITEC City, Hyderabad",
        mentor: "Ravi Kumar",
        internshipStart: iso(nextMonth),
        internshipEnd: iso(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)),
      };
    case "MARRIAGE_BEREAVEMENT":
      return { relation: "Sister", reason: "Sister's wedding" };
    case "RE_EXAM":
      return { subject: "Mathematics", examDate: iso(nextMonth), examHall: "Block A - Hall 3" };
    case "LONG_LEAVE":
      return { destination: "Hyderabad", reason: "Family function at home" };
    case "DIFFERENT_HOSTEL":
      return { destinationHostel: "Velankani Hostel", reason: "Staying with friend for exam prep" };
    default:
      return { reason: "Dummy leave request" };
  }
}

function daysFromNow(days: number, hourOffset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10 + hourOffset, 0, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding POC-assigned dummy tickets...\n");

  // ── Reference data ──
  const roleRows = await db.select({ id: roles.id, code: roles.code }).from(roles);
  const roleIdByCode = new Map(roleRows.map((r) => [r.code, r.id]));
  const pocRoleId = roleIdByCode.get(ROLES.POC);
  if (!pocRoleId) {
    console.error("❌ No POC role found in the DB.");
    process.exit(1);
  }

  // POC role assignments (scope rows)
  const pocAssignments = await db
    .select({
      userId: userRoles.userId,
      scopeType: userRoles.scopeType,
      scopeId: userRoles.scopeId,
    })
    .from(userRoles)
    .where(eq(userRoles.roleId, pocRoleId));

  const pocUserIds = [...new Set(pocAssignments.map((a) => a.userId))];
  if (pocUserIds.length === 0) {
    console.error("❌ No users hold the POC role. Assign the role first (super-admin → Users).");
    process.exit(1);
  }

  const pocUsers = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email })
    .from(users)
    .where(inArray(users.id, pocUserIds));
  console.log(`  POC user(s): ${pocUsers.map((u) => `${u.fullName} <${u.email}>`).join(", ")}`);

  // Hostels
  const allHostels = await db
    .select({ id: hostels.id, code: hostels.code, name: hostels.name })
    .from(hostels)
    .where(eq(hostels.isActive, true));

  // Students per hostel (via their user's hostel)
  const studentRows = await db
    .select({
      id: students.id,
      rollNumber: students.rollNumber,
      userId: students.userId,
      hostelId: users.hostelId,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id));
  const studentsByHostel = new Map<string, Array<{ id: string; rollNumber: string }>>();
  for (const row of studentRows) {
    if (!row.hostelId) continue;
    const list = studentsByHostel.get(row.hostelId) ?? [];
    list.push({ id: row.id, rollNumber: row.rollNumber });
    studentsByHostel.set(row.hostelId, list);
  }

  // Parent per student (for approved parent steps)
  const parentRows = await db
    .select({ id: parents.id, studentId: parents.studentId })
    .from(parents);
  const parentByStudent = new Map<string, string>();
  for (const p of parentRows) {
    if (!parentByStudent.has(p.studentId)) parentByStudent.set(p.studentId, p.id);
  }

  // Workflow steps: leave-type default workflow → sorted steps
  const stepRows = await db
    .select({
      workflowDefinitionId: workflowSteps.workflowDefinitionId,
      stepKey: workflowSteps.stepKey,
      stepOrder: workflowSteps.stepOrder,
      approverRoleId: workflowSteps.approverRoleId,
      isParentApproval: workflowSteps.isParentApproval,
    })
    .from(workflowSteps);
  const stepsByWorkflow = new Map<string, WorkflowStepRow[]>();
  for (const s of stepRows) {
    const list = stepsByWorkflow.get(s.workflowDefinitionId) ?? [];
    list.push({
      stepKey: s.stepKey,
      stepOrder: s.stepOrder,
      approverRoleId: s.approverRoleId,
      isParentApproval: s.isParentApproval,
    });
    stepsByWorkflow.set(s.workflowDefinitionId, list);
  }
  for (const list of stepsByWorkflow.values()) list.sort((a, b) => a.stepOrder - b.stepOrder);

  // Leave types that have a POC_APPROVAL step in their default workflow
  const allLeaveTypes = await db
    .select({ id: leaveTypes.id, code: leaveTypes.code, name: leaveTypes.name, defaultWorkflowId: leaveTypes.defaultWorkflowId })
    .from(leaveTypes)
    .where(eq(leaveTypes.isActive, true));

  const pocLeaveTypes = allLeaveTypes.filter((lt) => {
    const workflowId = lt.defaultWorkflowId;
    if (!workflowId) return false;
    const steps = stepsByWorkflow.get(workflowId);
    if (!steps) return false;
    return steps.some((s) => s.stepKey === WORKFLOW_STEP_KEY.POC_APPROVAL);
  });

  if (pocLeaveTypes.length === 0) {
    console.error("❌ No leave type has a POC_APPROVAL workflow step.");
    process.exit(1);
  }
  console.log(
    `  Leave types with a POC step: ${pocLeaveTypes.map((lt) => `${lt.code} (${lt.name})`).join(", ")}`
  );

  // ── Clean up previous POC dummy tickets (idempotency) ──
  const existing = await db
    .select({ id: leaveRequests.id })
    .from(leaveRequests)
    .where(like(leaveRequests.requestNumber, "LR-POC-%"));
  if (existing.length > 0) {
    console.log(`  Removing ${existing.length} previously seeded POC ticket(s)...`);
    await db
      .delete(leaveRequests)
      .where(like(leaveRequests.requestNumber, "LR-POC-%"));
  }

  // ── Build tickets ──
  const leaveValues: Array<typeof leaveRequests.$inferInsert> = [];
  const approvalValues: Array<typeof leaveApprovals.$inferInsert> = [];

  let ticketCount = 0;
  let pickOffset = 0;

  for (const pocUser of pocUsers) {
    // Scoped hostel ids for this POC (HOSTEL scope rows). Empty = all hostels.
    const scopedHostelIds = pocAssignments
      .filter(
        (a) => a.userId === pocUser.id &&
          a.scopeType === ROLE_SCOPE_TYPE.HOSTEL &&
          !!a.scopeId
      )
      .map((a) => a.scopeId as string);
    const targetHostels = scopedHostelIds.length > 0
      ? allHostels.filter((h) => scopedHostelIds.includes(h.id))
      : allHostels;
    const scopeNote = scopedHostelIds.length > 0
      ? `scoped to ${targetHostels.map((h) => h.code).join(", ")}`
      : "unscoped (all hostels)";
    console.log(`\n  ${pocUser.fullName} — ${scopeNote}`);

    for (const hostel of targetHostels) {
      const hostelStudents = studentsByHostel.get(hostel.id) ?? [];
      if (hostelStudents.length === 0) {
        console.warn(`    ⚠️ No student in hostel ${hostel.code} — skipping`);
        continue;
      }

      for (const leaveType of pocLeaveTypes) {
        const student = hostelStudents[pickOffset % hostelStudents.length]!;
        pickOffset += 1;

        const steps = stepsByWorkflow.get(leaveType.defaultWorkflowId!) ?? [];
        const pocIndex = steps.findIndex((s) => s.stepKey === WORKFLOW_STEP_KEY.POC_APPROVAL);
        if (pocIndex === -1) continue;

        const pocStep = steps[pocIndex]!;
        const parentId = parentByStudent.get(student.id) ?? null;
        const createdAt = daysFromNow(-(ticketCount % 3), ticketCount % 4); // spread over 3 days
        const leaveId = randomUUID();

        leaveValues.push({
          id: leaveId,
          requestNumber: `LR-POC-${leaveType.code}-${hostel.code}-${ticketCount + 1}`,
          studentId: student.id,
          leaveTypeId: leaveType.id,
          reason: `Dummy: ${leaveType.name} — ${hostel.code} (${student.rollNumber})`,
          status: LEAVE_REQUEST_STATUS.PENDING,
          currentStepKey: WORKFLOW_STEP_KEY.POC_APPROVAL,
          currentStepOrder: pocStep.stepOrder,
          policyResult: { allowed: true, checks: [] },
          startAt: daysFromNow(1 + (ticketCount % 2)),
          endAt: daysFromNow(2 + (ticketCount % 3)),
          submittedForm: buildSubmittedForm(leaveType.code),
          submittedAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        });

        for (const [i, step] of steps.entries()) {
          const before = i < pocIndex;
          approvalValues.push({
            leaveRequestId: leaveId,
            stepKey: step.stepKey,
            stepOrder: step.stepOrder,
            approverRoleId: step.approverRoleId,
            approverUserId:
              step.stepKey === WORKFLOW_STEP_KEY.POC_APPROVAL ? pocUser.id : null,
            approverParentId: step.isParentApproval ? parentId : null,
            decision: before
              ? step.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
                ? LEAVE_APPROVAL_DECISION.AUTO_APPROVED
                : LEAVE_APPROVAL_DECISION.APPROVED
              : LEAVE_APPROVAL_DECISION.PENDING,
            approvalSource:
              step.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
                ? LEAVE_APPROVAL_SOURCE.SYSTEM
                : LEAVE_APPROVAL_SOURCE.WEB,
            actedAt: before ? createdAt : null,
            createdAt,
          });
        }

        ticketCount += 1;
      }
    }
  }

  if (ticketCount === 0) {
    console.error("\n❌ No tickets could be built (check students/hostels).");
    process.exit(1);
  }

  console.log(`\n  Inserting ${ticketCount} tickets (${approvalValues.length} approval rows)...`);
  await db.insert(leaveRequests).values(leaveValues);
  await db.insert(leaveApprovals).values(approvalValues);

  console.log("\n✅ Done!");
  console.log(`   POC tickets: ${ticketCount}`);
  for (const v of leaveValues) {
    console.log(`     - ${v.requestNumber} | ${v.reason} | currentStep=${v.currentStepKey}`);
  }
}

main()
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  })
  .finally(() => process.exit());
