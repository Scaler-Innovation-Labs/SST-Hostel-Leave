/**
 * Seeds comprehensive dummy leave data covering EVERY leave type at EVERY
 * workflow stage and from EVERY hostel.
 *
 * For each leave type × hostel it creates:
 *   - a PENDING leave parked at each workflow step (parent pending, POC
 *     pending, admin pending, ...) — so every "waiting on" state is covered
 *   - one APPROVED, one REJECTED, one CANCELLED, one EXPIRED and one
 *     COMPLETED leave — so every status is covered per hostel
 *   - extra APPROVED / REJECTED / EXPIRED / COMPLETED history spread over
 *     the last 3 weeks — so lists and analytics have volume
 *
 * It also creates:
 *   - extension requests in every state (PENDING at the first/last step,
 *     APPROVED, REJECTED, plus a second pending extension) on APPROVED
 *     leaves of the types that allow extensions
 *   - a few clearly OVERDUE pending leaves (created 4 days ago, so the
 *     approvals page flags them past the 24h overdue threshold)
 *
 * The script is idempotent: any existing leaves with requestNumber prefix
 * `LR-DUMMY-` are deleted (cascade removes their approvals and extensions)
 * and re-created, so re-running always produces exactly one matrix.
 *
 * Hostels without any student get a dummy student created so the matrix can
 * be generated "from each hostel".
 *
 * Usage:
 *   npx tsx scripts/seed-all-leave-types.ts
 */

import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { randomUUID } from "node:crypto";

import { eq, inArray, like } from "drizzle-orm";

import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { QR_SCAN_RESULT } from "@/constants/movement/qr-scan-result";
import { QR_SCAN_TYPE } from "@/constants/movement/qr-scan-type";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { QR_TYPE } from "@/constants/movement/qr-type";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import {
  academicGroups,
  hostels,
  leaveApprovals,
  leaveExtensions,
  leaveRequests,
  leaveTypes,
  movementEvents,
  parents,
  qrPasses,
  qrScanLogs,
  roles,
  students,
  userRoles,
  users,
  workflowDefinitions,
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

type LeaveSeed = {
  id: string;
  requestNumber: string;
  studentId: string;
  leaveTypeId: string;
  hostelCode: string;
  leaveTypeCode: string;
  status: string;
  reason: string;
  submittedForm: Record<string, unknown>;
  policyResult: { allowed: boolean; checks: unknown[] };
  currentStepKey: string | null;
  currentStepOrder: number | null;
  startAt: Date;
  endAt: Date;
  submittedAt: Date;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
  completedAt: Date | null;
  actualReturnAt: Date | null;
  approvals: Array<{
    stepKey: string;
    stepOrder: number;
    approverRoleId: string | null;
    decision: string;
    approvalSource: string;
    actedAt: Date | null;
  }>;
};

type ExtensionSeed = {
  id: string;
  leaveRequestId: string;
  extensionNumber: number;
  currentEndAt: Date;
  requestedEndAt: Date;
  reason: string;
  status: string;
  currentStepKey: string | null;
  currentStepOrder: number | null;
  submittedAt: Date;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  approvals: Array<{
    stepKey: string;
    stepOrder: number;
    approverRoleId: string | null;
    approverParentId: string | null;
    decision: string;
    approvalSource: string;
    actedAt: Date | null;
  }>;
};

function approvalDecisionsForStep(
  step: WorkflowStepRow,
): { decision: string; approvalSource: string } {
  return {
    decision:
      step.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
        ? LEAVE_APPROVAL_DECISION.AUTO_APPROVED
        : LEAVE_APPROVAL_DECISION.APPROVED,
    approvalSource:
      step.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
        ? LEAVE_APPROVAL_SOURCE.SYSTEM
        : LEAVE_APPROVAL_SOURCE.WEB,
  };
}

function buildExtensionApprovals(
  steps: WorkflowStepRow[],
  parentId: string | null,
  opts: {
    parkIndex: number | null; // pending at this step (earlier steps approved)
    approved: boolean; // every step approved
    rejected: boolean; // reject at the last step
    actedAt: Date | null;
  },
): ExtensionSeed["approvals"] {
  return steps.map((step, j) => {
    let decision: string = LEAVE_APPROVAL_DECISION.PENDING;
    if (opts.approved) {
      decision = approvalDecisionsForStep(step).decision;
    } else if (opts.rejected && j === steps.length - 1) {
      decision = LEAVE_APPROVAL_DECISION.REJECTED;
    } else if (opts.parkIndex != null && j < opts.parkIndex) {
      decision = approvalDecisionsForStep(step).decision;
    }
    return {
      stepKey: step.stepKey,
      stepOrder: step.stepOrder,
      approverRoleId: step.approverRoleId,
      approverParentId: step.isParentApproval ? parentId : null,
      decision,
      approvalSource: approvalDecisionsForStep(step).approvalSource,
      actedAt: decision === LEAVE_APPROVAL_DECISION.PENDING ? null : opts.actedAt,
    };
  });
}

const STAGE_DESC: Record<string, string> = {
  [WORKFLOW_STEP_KEY.PARENT_APPROVAL]: "waiting on parent",
  [WORKFLOW_STEP_KEY.POC_APPROVAL]: "waiting on POC",
  [WORKFLOW_STEP_KEY.ADMIN_APPROVAL]: "waiting on admin",
  [WORKFLOW_STEP_KEY.AUTO_APPROVAL]: "waiting on auto-approval",
  [WORKFLOW_STEP_KEY.NOTIFICATION]: "notification step",
  [WORKFLOW_STEP_KEY.QR_EXIT]: "QR exit step",
  [WORKFLOW_STEP_KEY.QR_RETURN]: "QR return step",
  [WORKFLOW_STEP_KEY.COMPLETE]: "completion step",
};

function buildSubmittedForm(leaveTypeCode: string): Record<string, unknown> {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  switch (leaveTypeCode) {
    case "RE_EXAM":
      return { subject: "Mathematics", examDate: iso(nextMonth), examHall: "Block A - Hall 3" };
    case "LONG_LEAVE":
      return { destination: "Hyderabad", reason: "Family function at home" };
    case "LATE_ENTRY":
      return { reason: "Train delayed" };
    case "LATE_STAY_COLLEGE":
      return { reason: "Project submission in lab" };
    case "DIFFERENT_HOSTEL":
      return { destinationHostel: "Velankani Hostel", reason: "Staying with friend for exam prep" };
    case "HOLIDAY":
      return { destination: "Chennai" };
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
  console.log("Seeding dummy leaves for all leave types × stages × hostels...\n");

  // ── Fetch reference data ──
  const allHostels = await db.select().from(hostels).where(eq(hostels.isActive, true));
  if (allHostels.length === 0) {
    console.error("❌ No hostels found. Run the main seed first.");
    process.exit(1);
  }
  console.log(`  Hostels (${allHostels.length}): ${allHostels.map((h) => `${h.code} (${h.name})`).join(", ")}`);

  const allLeaveTypes = await db.select().from(leaveTypes);
  if (allLeaveTypes.length === 0) {
    console.error("❌ No leave types found. Run the main seed first.");
    process.exit(1);
  }
  console.log(`  Leave types (${allLeaveTypes.length}): ${allLeaveTypes.map((lt) => lt.code).join(", ")}`);

  const roleRows = await db.select({ id: roles.id, code: roles.code }).from(roles);
  const roleMap = new Map(roleRows.map((r) => [r.code, r.id]));

  const groupRows = await db.select({ id: academicGroups.id }).from(academicGroups).limit(1);
  if (groupRows.length === 0) {
    console.error("❌ No academic groups found. Run the main seed first.");
    process.exit(1);
  }
  const academicGroupId = groupRows[0]!.id;

  // Workflow steps per workflow definition (workflow code === leave type code)
  const defs = await db.select({ id: workflowDefinitions.id, code: workflowDefinitions.code }).from(workflowDefinitions);
  const defMap = new Map(defs.map((d) => [d.code, d.id]));
  const stepRows = await db.select().from(workflowSteps);
  const stepsByWorkflow = new Map<string, WorkflowStepRow[]>();
  for (const s of stepRows) {
    const code = defs.find((d) => d.id === s.workflowDefinitionId)?.code ?? "";
    if (!code) continue;
    const list = stepsByWorkflow.get(code) ?? [];
    list.push({
      stepKey: s.stepKey,
      stepOrder: s.stepOrder,
      approverRoleId: s.approverRoleId,
      isParentApproval: s.isParentApproval,
    });
    stepsByWorkflow.set(code, list);
  }
  for (const list of stepsByWorkflow.values()) {
    list.sort((a, b) => a.stepOrder - b.stepOrder);
  }

  const stepsFor = (leaveType: (typeof allLeaveTypes)[number]): WorkflowStepRow[] => {
    const workflowCode =
      defs.find((d) => d.id === leaveType.defaultWorkflowId)?.code ?? leaveType.code;
    const workflowId = defMap.get(workflowCode);
    return (workflowId ? stepsByWorkflow.get(workflowCode) : undefined) ?? [];
  };

  // Parents per student (for approverParentId on parent-approval steps)
  const parentRows = await db
    .select({ id: parents.id, studentId: parents.studentId })
    .from(parents);
  const parentByStudent = new Map<string, string>();
  for (const p of parentRows) {
    if (!parentByStudent.has(p.studentId)) parentByStudent.set(p.studentId, p.id);
  }

  // ── Students per hostel (create one dummy student per hostel without one) ──
  const studentRows = await db
    .select({ id: students.id, userId: students.userId, hostelId: users.hostelId })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id));

  const studentsByHostel = new Map<string, Array<{ id: string; userId: string }>>();
  for (const row of studentRows) {
    if (!row.hostelId) continue;
    const list = studentsByHostel.get(row.hostelId) ?? [];
    list.push({ id: row.id, userId: row.userId });
    studentsByHostel.set(row.hostelId, list);
  }

  const studentRoleId = roleMap.get(ROLES.STUDENT);
  const userInserts: Array<typeof users.$inferInsert> = [];
  const studentInserts: Array<typeof students.$inferInsert> = [];
  const userRoleInserts: Array<typeof userRoles.$inferInsert> = [];
  let dummyCounter = 0;

  for (const hostel of allHostels) {
    const existing = studentsByHostel.get(hostel.id);
    if (existing && existing.length > 0) continue;

    dummyCounter += 1;
    const userId = randomUUID();
    const studentId = randomUUID();
    const suffix = String(1000 + dummyCounter);

    console.log(`  Creating dummy student for hostel ${hostel.code} (no student assigned yet)`);

    userInserts.push({
      id: userId,
      fullName: `Dummy Student ${hostel.code}`,
      email: `dummy.student.${hostel.code.toLowerCase()}@example.com`,
      phone: `99000000${dummyCounter}`,
      hostelId: hostel.id,
      isActive: true,
    });
    studentInserts.push({
      id: studentId,
      userId,
      academicGroupId,
      rollNumber: `DUM${suffix}`,
      roomNumber: "101",
      currentLocationState: "IN_HOSTEL",
    });
    if (studentRoleId) {
      userRoleInserts.push({ userId, roleId: studentRoleId });
    }

    studentsByHostel.set(hostel.id, [...(existing ?? []), { id: studentId, userId }]);
  }

  if (userInserts.length > 0) {
    await db.insert(users).values(userInserts).onConflictDoNothing();
    await db.insert(students).values(studentInserts).onConflictDoNothing();
    if (userRoleInserts.length > 0) {
      await db.insert(userRoles).values(userRoleInserts).onConflictDoNothing();
    }
  }

  // ── Clean up previous dummy matrix (idempotency) ──
  const existingDummy = await db
    .select({ id: leaveRequests.id, requestNumber: leaveRequests.requestNumber })
    .from(leaveRequests)
    .where(like(leaveRequests.requestNumber, "LR-DUMMY-%"));

  if (existingDummy.length > 0) {
    const dummyLeaveIds = existingDummy.map((d) => d.id);

    // Clean up rows that reference the dummy leaves but do NOT cascade from
    // leave deletion (qr_scan_logs / movement_events null their FKs instead).
    const dummyQrPasses = await db
      .select({ id: qrPasses.id })
      .from(qrPasses)
      .where(inArray(qrPasses.leaveRequestId, dummyLeaveIds));

    if (dummyQrPasses.length > 0) {
      await db
        .delete(qrScanLogs)
        .where(inArray(qrScanLogs.qrPassId, dummyQrPasses.map((q) => q.id)));
    }

    await db
      .delete(movementEvents)
      .where(inArray(movementEvents.leaveRequestId, dummyLeaveIds));

    console.log(`  Removing ${existingDummy.length} previously seeded dummy leave(s) (cascade deletes approvals + QR passes)...`);
    await db.delete(leaveRequests).where(like(leaveRequests.requestNumber, "LR-DUMMY-%"));
  }

  // ── Build the matrix ──
  const seeds: LeaveSeed[] = [];
  const extensionSeeds: ExtensionSeed[] = [];

  for (const leaveType of allLeaveTypes) {
    const steps = stepsFor(leaveType);

    if (steps.length === 0) {
      console.warn(`  ⚠️ No workflow steps found for ${leaveType.code} — skipping`);
      continue;
    }

    for (const hostel of allHostels) {
      const hostelStudents = studentsByHostel.get(hostel.id) ?? [];
      if (hostelStudents.length === 0) {
        console.warn(`  ⚠️ No student for hostel ${hostel.code} — skipping`);
        continue;
      }

      let pick = 0;
      const nextStudent = () => {
        const s = hostelStudents[pick % hostelStudents.length]!;
        pick += 1;
        return s;
      };

      // 1) PENDING at every workflow stage
      for (let i = 0; i < steps.length; i++) {
        const student = nextStudent();
        const createdAt = daysFromNow(-1);
        seeds.push({
          id: randomUUID(),
          requestNumber: `LR-DUMMY-${leaveType.code}-${hostel.code}-PENDING-${steps[i]!.stepKey}-${Math.random().toString(36).slice(2, 6)}`,
          studentId: student.id,
          leaveTypeId: leaveType.id,
          hostelCode: hostel.code,
          leaveTypeCode: leaveType.code,
          status: LEAVE_REQUEST_STATUS.PENDING,
          reason: `Dummy: ${leaveType.name} — ${STAGE_DESC[steps[i]!.stepKey] ?? steps[i]!.stepKey} (${hostel.code})`,
          submittedForm: buildSubmittedForm(leaveType.code),
          policyResult: { allowed: true, checks: [] },
          currentStepKey: steps[i]!.stepKey,
          currentStepOrder: steps[i]!.stepOrder,
          startAt: daysFromNow(1),
          endAt: daysFromNow(3),
          submittedAt: createdAt,
          createdAt,
          approvedAt: null,
          rejectedAt: null,
          cancelledAt: null,
          expiredAt: null,
          completedAt: null,
          actualReturnAt: null,
          approvals: steps.map((step, j) => ({
            stepKey: step.stepKey,
            stepOrder: step.stepOrder,
            approverRoleId: step.approverRoleId,
            decision:
              j < i
                ? step.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
                  ? LEAVE_APPROVAL_DECISION.AUTO_APPROVED
                  : LEAVE_APPROVAL_DECISION.APPROVED
                : LEAVE_APPROVAL_DECISION.PENDING,
            approvalSource:
              step.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
                ? LEAVE_APPROVAL_SOURCE.SYSTEM
                : LEAVE_APPROVAL_SOURCE.WEB,
            actedAt: j < i ? createdAt : null,
          })),
        });
      }

      // 2) Lifecycle statuses (one of each per type × hostel)
      const lastStep = steps[steps.length - 1]!;
      const allApprovedDecisions = (step: WorkflowStepRow) =>
        step.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
          ? LEAVE_APPROVAL_DECISION.AUTO_APPROVED
          : LEAVE_APPROVAL_DECISION.APPROVED;

      const lifecycle: Array<{
        status: string;
        daysAgo: number;
        reasonSuffix: string;
        approvals: (step: WorkflowStepRow, actedAt: Date) => LeaveSeed["approvals"];
        leaveFields: Partial<Pick<LeaveSeed, "approvedAt" | "rejectedAt" | "cancelledAt" | "expiredAt" | "completedAt" | "actualReturnAt" | "startAt" | "endAt">>;
      }> = [
        {
          status: LEAVE_REQUEST_STATUS.APPROVED,
          daysAgo: 2,
          reasonSuffix: "approved",
          approvals: (_step, actedAt) =>
            steps.map((s) => ({
              stepKey: s.stepKey,
              stepOrder: s.stepOrder,
              approverRoleId: s.approverRoleId,
              decision: allApprovedDecisions(s),
              approvalSource:
                s.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
                  ? LEAVE_APPROVAL_SOURCE.SYSTEM
                  : LEAVE_APPROVAL_SOURCE.WEB,
              actedAt,
            })),
          leaveFields: { approvedAt: daysFromNow(-2, 1) },
        },
        {
          status: LEAVE_REQUEST_STATUS.REJECTED,
          daysAgo: 3,
          reasonSuffix: "rejected",
          approvals: (_step, actedAt) =>
            steps.map((s) => ({
              stepKey: s.stepKey,
              stepOrder: s.stepOrder,
              approverRoleId: s.approverRoleId,
              decision: s.stepOrder === lastStep.stepOrder ? LEAVE_APPROVAL_DECISION.REJECTED : allApprovedDecisions(s),
              approvalSource:
                s.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
                  ? LEAVE_APPROVAL_SOURCE.SYSTEM
                  : LEAVE_APPROVAL_SOURCE.WEB,
              actedAt,
            })),
          leaveFields: { rejectedAt: daysFromNow(-3, 1) },
        },
        {
          status: LEAVE_REQUEST_STATUS.CANCELLED,
          daysAgo: 4,
          reasonSuffix: "cancelled",
          approvals: (_step, _actedAt) =>
            steps.map((s) => ({
              stepKey: s.stepKey,
              stepOrder: s.stepOrder,
              approverRoleId: s.approverRoleId,
              decision: LEAVE_APPROVAL_DECISION.PENDING,
              approvalSource:
                s.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
                  ? LEAVE_APPROVAL_SOURCE.SYSTEM
                  : LEAVE_APPROVAL_SOURCE.WEB,
              actedAt: null,
            })),
          leaveFields: { cancelledAt: daysFromNow(-4, 1) },
        },
        {
          status: LEAVE_REQUEST_STATUS.EXPIRED,
          daysAgo: 12,
          reasonSuffix: "expired",
          approvals: (_step, actedAt) =>
            steps.map((s) => ({
              stepKey: s.stepKey,
              stepOrder: s.stepOrder,
              approverRoleId: s.approverRoleId,
              decision: allApprovedDecisions(s),
              approvalSource:
                s.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
                  ? LEAVE_APPROVAL_SOURCE.SYSTEM
                  : LEAVE_APPROVAL_SOURCE.WEB,
              actedAt,
            })),
          leaveFields: {
            startAt: daysFromNow(-12),
            endAt: daysFromNow(-10),
            approvedAt: daysFromNow(-12, 1),
            expiredAt: daysFromNow(-10, 1),
          },
        },
        {
          status: LEAVE_REQUEST_STATUS.COMPLETED,
          daysAgo: 7,
          reasonSuffix: "completed",
          approvals: (_step, actedAt) =>
            steps.map((s) => ({
              stepKey: s.stepKey,
              stepOrder: s.stepOrder,
              approverRoleId: s.approverRoleId,
              decision: allApprovedDecisions(s),
              approvalSource:
                s.stepKey === WORKFLOW_STEP_KEY.AUTO_APPROVAL
                  ? LEAVE_APPROVAL_SOURCE.SYSTEM
                  : LEAVE_APPROVAL_SOURCE.WEB,
              actedAt,
            })),
          leaveFields: {
            startAt: daysFromNow(-7),
            endAt: daysFromNow(-5),
            approvedAt: daysFromNow(-7, 1),
            completedAt: daysFromNow(-5, 1),
            actualReturnAt: daysFromNow(-5, 2),
          },
        },
      ];

      for (const item of lifecycle) {
        const student = nextStudent();
        const createdAt = daysFromNow(-item.daysAgo);
        const actedAt = daysFromNow(-item.daysAgo, 1);
        seeds.push({
          id: randomUUID(),
          requestNumber: `LR-DUMMY-${leaveType.code}-${hostel.code}-${item.status}-${Math.random().toString(36).slice(2, 6)}`,
          studentId: student.id,
          leaveTypeId: leaveType.id,
          hostelCode: hostel.code,
          leaveTypeCode: leaveType.code,
          status: item.status,
          reason: `Dummy: ${leaveType.name} — ${item.reasonSuffix} (${hostel.code})`,
          submittedForm: buildSubmittedForm(leaveType.code),
          policyResult: { allowed: true, checks: [] },
          currentStepKey: null,
          currentStepOrder: null,
          startAt: item.leaveFields.startAt ?? daysFromNow(1),
          endAt: item.leaveFields.endAt ?? daysFromNow(3),
          submittedAt: createdAt,
          createdAt,
          approvedAt: item.leaveFields.approvedAt ?? null,
          rejectedAt: item.leaveFields.rejectedAt ?? null,
          cancelledAt: item.leaveFields.cancelledAt ?? null,
          expiredAt: item.leaveFields.expiredAt ?? null,
          completedAt: item.leaveFields.completedAt ?? null,
          actualReturnAt: item.leaveFields.actualReturnAt ?? null,
          approvals: item.approvals(lastStep, actedAt),
        });
      }

      // 3) Extra history — approved/rejected/expired/completed spread over the last 3 weeks
      const volume: Array<{
        status: string;
        daysAgo: number;
        reasonSuffix: string;
        startDays: number;
        endDays: number;
      }> = [
        { status: LEAVE_REQUEST_STATUS.APPROVED, daysAgo: 7, reasonSuffix: "approved (history)", startDays: 2, endDays: 5 },
        { status: LEAVE_REQUEST_STATUS.APPROVED, daysAgo: 15, reasonSuffix: "approved (old)", startDays: 9, endDays: 12 },
        { status: LEAVE_REQUEST_STATUS.REJECTED, daysAgo: 5, reasonSuffix: "rejected", startDays: 1, endDays: 3 },
        { status: LEAVE_REQUEST_STATUS.REJECTED, daysAgo: 12, reasonSuffix: "rejected (old)", startDays: 6, endDays: 8 },
        { status: LEAVE_REQUEST_STATUS.EXPIRED, daysAgo: 20, reasonSuffix: "expired", startDays: -18, endDays: -16 },
        { status: LEAVE_REQUEST_STATUS.COMPLETED, daysAgo: 10, reasonSuffix: "completed", startDays: -8, endDays: -6 },
      ];

      for (const v of volume) {
        const student = nextStudent();
        const createdAt = daysFromNow(-v.daysAgo);
        const actedAt = daysFromNow(-v.daysAgo, 1);
        const isRejected = v.status === LEAVE_REQUEST_STATUS.REJECTED;
        seeds.push({
          id: randomUUID(),
          requestNumber: `LR-DUMMY-${leaveType.code}-${hostel.code}-${v.status}-X${v.daysAgo}-${Math.random().toString(36).slice(2, 6)}`,
          studentId: student.id,
          leaveTypeId: leaveType.id,
          hostelCode: hostel.code,
          leaveTypeCode: leaveType.code,
          status: v.status,
          reason: `Dummy: ${leaveType.name} — ${v.reasonSuffix} (${hostel.code})`,
          submittedForm: buildSubmittedForm(leaveType.code),
          policyResult: { allowed: true, checks: [] },
          currentStepKey: null,
          currentStepOrder: null,
          startAt: daysFromNow(v.startDays),
          endAt: daysFromNow(v.endDays),
          submittedAt: createdAt,
          createdAt,
          approvedAt: isRejected ? null : actedAt,
          rejectedAt: isRejected ? actedAt : null,
          cancelledAt: null,
          expiredAt: v.status === LEAVE_REQUEST_STATUS.EXPIRED ? actedAt : null,
          completedAt: v.status === LEAVE_REQUEST_STATUS.COMPLETED ? actedAt : null,
          actualReturnAt: v.status === LEAVE_REQUEST_STATUS.COMPLETED ? daysFromNow(-6, 2) : null,
          approvals: steps.map((s) => {
            const base = approvalDecisionsForStep(s);
            return {
              stepKey: s.stepKey,
              stepOrder: s.stepOrder,
              approverRoleId: s.approverRoleId,
              decision:
                isRejected && s.stepOrder === lastStep.stepOrder
                  ? LEAVE_APPROVAL_DECISION.REJECTED
                  : base.decision,
              approvalSource: base.approvalSource,
              actedAt,
            };
          }),
        });
      }
    }
  }

  // ── Overdue pending leaves (created >24h ago → flagged Overdue on approvals pages) ──
  for (let ti = 0; ti < allLeaveTypes.length; ti++) {
    const leaveType = allLeaveTypes[ti]!;
    const steps = stepsFor(leaveType);
    if (steps.length === 0) continue;

    const hostel = allHostels[ti % allHostels.length]!;
    const hostelStudents = studentsByHostel.get(hostel.id) ?? [];
    if (hostelStudents.length === 0) continue;

    const student = hostelStudents[ti % hostelStudents.length]!;
    const lastStep = steps[steps.length - 1]!;
    const createdAt = daysFromNow(-4);
    seeds.push({
      id: randomUUID(),
      requestNumber: `LR-DUMMY-${leaveType.code}-${hostel.code}-OVERDUE-${Math.random().toString(36).slice(2, 6)}`,
      studentId: student.id,
      leaveTypeId: leaveType.id,
      hostelCode: hostel.code,
      leaveTypeCode: leaveType.code,
      status: LEAVE_REQUEST_STATUS.PENDING,
      reason: `Dummy: ${leaveType.name} — overdue, ${STAGE_DESC[lastStep.stepKey] ?? lastStep.stepKey} (${hostel.code})`,
      submittedForm: buildSubmittedForm(leaveType.code),
      policyResult: { allowed: true, checks: [] },
      currentStepKey: lastStep.stepKey,
      currentStepOrder: lastStep.stepOrder,
      startAt: daysFromNow(1),
      endAt: daysFromNow(3),
      submittedAt: createdAt,
      createdAt,
      approvedAt: null,
      rejectedAt: null,
      cancelledAt: null,
      expiredAt: null,
      completedAt: null,
      actualReturnAt: null,
      approvals: steps.map((s) => ({
        stepKey: s.stepKey,
        stepOrder: s.stepOrder,
        approverRoleId: s.approverRoleId,
        decision:
          s.stepOrder === lastStep.stepOrder
            ? LEAVE_APPROVAL_DECISION.PENDING
            : approvalDecisionsForStep(s).decision,
        approvalSource: approvalDecisionsForStep(s).approvalSource,
        actedAt: s.stepOrder === lastStep.stepOrder ? null : createdAt,
      })),
    });
  }

  // ── Extension requests (every state) on APPROVED leaves of extensible types ──
  for (const leaveType of allLeaveTypes) {
    if (!leaveType.allowExtensions) continue;
    const steps = stepsFor(leaveType);
    if (steps.length === 0) continue;

    for (const hostel of allHostels) {
      const hostelStudents = studentsByHostel.get(hostel.id) ?? [];
      if (hostelStudents.length === 0) continue;

      let pick = 0;
      const nextStudent = () => {
        const s = hostelStudents[pick % hostelStudents.length]!;
        pick += 1;
        return s;
      };

      const baseCreated = daysFromNow(-3);
      const baseStart = daysFromNow(2);
      const baseEnd = daysFromNow(5);
      const extCreated = daysFromNow(-2);
      const requestedEnd = daysFromNow(8);

      const scenarios: Array<{
        tag: string;
        exts: Array<{ number: number; status: string; parkIndex: number | null }>;
        extendLeaveTo: Date | null;
      }> = [
        {
          tag: "EXT-PENDING",
          exts: [{ number: 1, status: LEAVE_REQUEST_STATUS.PENDING, parkIndex: steps.length - 1 }],
          extendLeaveTo: null,
        },
        {
          tag: "EXT-APPROVED",
          exts: [{ number: 1, status: LEAVE_REQUEST_STATUS.APPROVED, parkIndex: null }],
          extendLeaveTo: requestedEnd,
        },
        {
          tag: "EXT-REJECTED",
          exts: [{ number: 1, status: LEAVE_REQUEST_STATUS.REJECTED, parkIndex: null }],
          extendLeaveTo: null,
        },
        {
          tag: "EXT-MULTI",
          exts: [
            { number: 1, status: LEAVE_REQUEST_STATUS.APPROVED, parkIndex: null },
            { number: 2, status: LEAVE_REQUEST_STATUS.PENDING, parkIndex: 0 },
          ],
          extendLeaveTo: requestedEnd,
        },
      ];

      for (const sc of scenarios) {
        const student = nextStudent();
        const parentId = parentByStudent.get(student.id) ?? null;
        const leaveId = randomUUID();

        seeds.push({
          id: leaveId,
          requestNumber: `LR-DUMMY-${leaveType.code}-${hostel.code}-BASE-${sc.tag}-${Math.random().toString(36).slice(2, 6)}`,
          studentId: student.id,
          leaveTypeId: leaveType.id,
          hostelCode: hostel.code,
          leaveTypeCode: leaveType.code,
          status: LEAVE_REQUEST_STATUS.APPROVED,
          reason: `Dummy: ${leaveType.name} — approved (${sc.tag}) (${hostel.code})`,
          submittedForm: buildSubmittedForm(leaveType.code),
          policyResult: { allowed: true, checks: [] },
          currentStepKey: null,
          currentStepOrder: null,
          startAt: baseStart,
          endAt: sc.extendLeaveTo ?? baseEnd,
          submittedAt: baseCreated,
          createdAt: baseCreated,
          approvedAt: daysFromNow(-3, 1),
          rejectedAt: null,
          cancelledAt: null,
          expiredAt: null,
          completedAt: null,
          actualReturnAt: null,
          approvals: steps.map((s) => ({
            stepKey: s.stepKey,
            stepOrder: s.stepOrder,
            approverRoleId: s.approverRoleId,
            decision: approvalDecisionsForStep(s).decision,
            approvalSource: approvalDecisionsForStep(s).approvalSource,
            actedAt: daysFromNow(-3, 1),
          })),
        });

        for (const ex of sc.exts) {
          const approved = ex.status === LEAVE_REQUEST_STATUS.APPROVED;
          const rejected = ex.status === LEAVE_REQUEST_STATUS.REJECTED;
          extensionSeeds.push({
            id: randomUUID(),
            leaveRequestId: leaveId,
            extensionNumber: ex.number,
            currentEndAt: baseEnd,
            requestedEndAt: requestedEnd,
            reason: `Dummy: extension #${ex.number} — ${leaveType.name} (${hostel.code})`,
            status: ex.status,
            currentStepKey: ex.parkIndex != null ? steps[ex.parkIndex]!.stepKey : null,
            currentStepOrder: ex.parkIndex != null ? steps[ex.parkIndex]!.stepOrder : null,
            submittedAt: extCreated,
            createdAt: extCreated,
            approvedAt: approved ? daysFromNow(-2, 1) : null,
            rejectedAt: rejected ? daysFromNow(-2, 1) : null,
            approvals: buildExtensionApprovals(steps, parentId, {
              parkIndex: ex.parkIndex,
              approved,
              rejected,
              actedAt: daysFromNow(-2, 1),
            }),
          });
        }
      }
    }
  }

  // ── Overdue returns: student checked out, never checked in, leave ended ──
  // Mirrors the real system's movement flow (movement-flow.md):
  //   LEAVE_APPROVED (IN_HOSTEL → APPROVED_LEAVE)
  //   EXIT_SCAN log + EXIT_HOSTEL (APPROVED_LEAVE → OUTSIDE_HOSTEL)
  //   AUTO_OVERDUE (OUTSIDE_HOSTEL → OVERDUE)
  // …so the student timeline and current_location_state are consistent.
  const overduePassInserts: Array<typeof qrPasses.$inferInsert> = [];
  const overdueScanLogInserts: Array<typeof qrScanLogs.$inferInsert> = [];
  const overdueMovementInserts: Array<typeof movementEvents.$inferInsert> = [];
  const overdueStudentIds: string[] = [];
  const overdueTypes = ["LONG_LEAVE", "DIFFERENT_HOSTEL", "INTERNSHIP"];

  // Gate scanner for the exit scan (same actor the real scan-qr flow records).
  const guardRoleId = roleMap.get(ROLES.GUARD);
  const guardRow = guardRoleId
    ? await db
        .select({ id: userRoles.userId })
        .from(userRoles)
        .where(eq(userRoles.roleId, guardRoleId))
        .limit(1)
    : [];
  const guardUserId = guardRow[0]?.id ?? null;

  for (const hostel of allHostels) {
    const hostelStudents = studentsByHostel.get(hostel.id) ?? [];
    if (hostelStudents.length === 0) continue;

    for (let i = 0; i < overdueTypes.length; i++) {
      const typeCode = overdueTypes[i]!;
      const leaveType = allLeaveTypes.find((lt) => lt.code === typeCode);
      if (!leaveType) continue;
      const steps = stepsFor(leaveType);
      if (steps.length === 0) continue;

      const student = hostelStudents[i % hostelStudents.length]!;
      const leaveId = randomUUID();
      const passId = randomUUID();
      const createdAt = daysFromNow(-11);
      const approvedAt = daysFromNow(-11, 1);
      const exitScannedAt = daysFromNow(-9);
      const overdueAt = daysFromNow(-7, 1); // after endAt (daysFromNow(-8))

      seeds.push({
        id: leaveId,
        requestNumber: `LR-DUMMY-${typeCode}-${hostel.code}-RETURN-OVERDUE-${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        leaveTypeId: leaveType.id,
        hostelCode: hostel.code,
        leaveTypeCode: typeCode,
        status: LEAVE_REQUEST_STATUS.APPROVED,
        reason: `Dummy: ${leaveType.name} — checked out, never returned (${hostel.code})`,
        submittedForm: buildSubmittedForm(typeCode),
        policyResult: { allowed: true, checks: [] },
        currentStepKey: null,
        currentStepOrder: null,
        startAt: daysFromNow(-10),
        endAt: daysFromNow(-8),
        submittedAt: createdAt,
        createdAt,
        approvedAt,
        rejectedAt: null,
        cancelledAt: null,
        expiredAt: null,
        completedAt: null,
        actualReturnAt: null,
        approvals: steps.map((s) => ({
          stepKey: s.stepKey,
          stepOrder: s.stepOrder,
          approverRoleId: s.approverRoleId,
          decision: approvalDecisionsForStep(s).decision,
          approvalSource: approvalDecisionsForStep(s).approvalSource,
          actedAt: approvedAt,
        })),
      });

      overduePassInserts.push({
        id: passId,
        leaveRequestId: leaveId,
        studentId: student.id,
        qrType: QR_TYPE.LEAVE_EXIT,
        tokenHash: `dummy-th-${randomUUID().replace(/-/g, "")}`,
        token: `dummy-tk-${randomUUID().replace(/-/g, "")}`,
        status: QR_STATUS.ACTIVE,
        generatedAt: createdAt,
        expiresAt: daysFromNow(20),
        firstScanAt: exitScannedAt,
        closedAt: null,
      });

      overdueScanLogInserts.push({
        qrPassId: passId,
        scannedBy: guardUserId,
        scanType: QR_SCAN_TYPE.EXIT_SCAN,
        scanResult: QR_SCAN_RESULT.SUCCESS,
        scannedAt: exitScannedAt,
      });

      overdueMovementInserts.push(
        {
          studentId: student.id,
          leaveRequestId: leaveId,
          qrPassId: passId,
          eventType: MOVEMENT_EVENT.LEAVE_APPROVED,
          fromState: MOVEMENT_STATE.IN_HOSTEL,
          toState: MOVEMENT_STATE.APPROVED_LEAVE,
          movementMethod: MOVEMENT_METHOD.SYSTEM,
          isManualOverride: false,
          occurredAt: approvedAt,
        },
        {
          studentId: student.id,
          leaveRequestId: leaveId,
          qrPassId: passId,
          eventType: MOVEMENT_EVENT.EXIT_HOSTEL,
          fromState: MOVEMENT_STATE.APPROVED_LEAVE,
          toState: MOVEMENT_STATE.OUTSIDE_HOSTEL,
          movementMethod: MOVEMENT_METHOD.QR,
          isManualOverride: false,
          recordedBy: guardUserId,
          occurredAt: exitScannedAt,
        },
        {
          studentId: student.id,
          leaveRequestId: leaveId,
          qrPassId: passId,
          eventType: MOVEMENT_EVENT.AUTO_OVERDUE,
          fromState: MOVEMENT_STATE.OUTSIDE_HOSTEL,
          toState: MOVEMENT_STATE.OVERDUE,
          movementMethod: MOVEMENT_METHOD.SYSTEM,
          isManualOverride: true,
          occurredAt: overdueAt,
        },
      );

      overdueStudentIds.push(student.id);
    }
  }

  // ── Insert in batches ──
  console.log(`\n  Inserting ${seeds.length} leaves + ${seeds.reduce((n, s) => n + s.approvals.length, 0)} approvals...`);

  const leaveValues = seeds.map((s) => ({
    id: s.id,
    requestNumber: s.requestNumber,
    studentId: s.studentId,
    leaveTypeId: s.leaveTypeId,
    reason: s.reason,
    status: s.status as never,
    currentStepKey: s.currentStepKey,
    currentStepOrder: s.currentStepOrder,
    policyResult: s.policyResult,
    startAt: s.startAt,
    endAt: s.endAt,
    actualReturnAt: s.actualReturnAt,
    submittedForm: s.submittedForm,
    submittedAt: s.submittedAt,
    approvedAt: s.approvedAt,
    rejectedAt: s.rejectedAt,
    cancelledAt: s.cancelledAt,
    expiredAt: s.expiredAt,
    completedAt: s.completedAt,
    createdAt: s.createdAt,
    updatedAt: s.createdAt,
  }));

  await db.insert(leaveRequests).values(leaveValues);

  const approvalValues = seeds.flatMap((s) =>
    s.approvals.map((a) => ({
      leaveRequestId: s.id,
      stepKey: a.stepKey,
      stepOrder: a.stepOrder,
      approverRoleId: a.approverRoleId,
      decision: a.decision as never,
      approvalSource: a.approvalSource as never,
      actedAt: a.actedAt,
      createdAt: s.createdAt,
    })),
  );

  await db.insert(leaveApprovals).values(approvalValues);

  if (overduePassInserts.length > 0) {
    await db.insert(qrPasses).values(overduePassInserts).onConflictDoNothing();
  }

  if (overdueScanLogInserts.length > 0) {
    await db.insert(qrScanLogs).values(overdueScanLogInserts);
  }

  if (overdueMovementInserts.length > 0) {
    await db.insert(movementEvents).values(overdueMovementInserts);
  }

  if (overdueStudentIds.length > 0) {
    await db
      .update(students)
      .set({ currentLocationState: MOVEMENT_STATE.OVERDUE })
      .where(inArray(students.id, overdueStudentIds));
    console.log(
      `  Marked ${overdueStudentIds.length} student(s) as ${MOVEMENT_STATE.OVERDUE} (checked out, never returned)`,
    );
  }

  // ── Insert extensions (and their approval chain) ──
  if (extensionSeeds.length > 0) {
    const extensionValues = extensionSeeds.map((e) => ({
      id: e.id,
      leaveRequestId: e.leaveRequestId,
      extensionNumber: e.extensionNumber,
      currentEndAt: e.currentEndAt,
      requestedEndAt: e.requestedEndAt,
      reason: e.reason,
      status: e.status as never,
      currentStepKey: e.currentStepKey,
      currentStepOrder: e.currentStepOrder,
      submittedForm: { reason: e.reason },
      submittedAt: e.submittedAt,
      approvedAt: e.approvedAt,
      rejectedAt: e.rejectedAt,
      createdAt: e.createdAt,
      updatedAt: e.createdAt,
    }));

    await db.insert(leaveExtensions).values(extensionValues);

    const extensionApprovalValues = extensionSeeds.flatMap((e) =>
      e.approvals.map((a) => ({
        leaveExtensionId: e.id,
        stepKey: a.stepKey,
        stepOrder: a.stepOrder,
        approverRoleId: a.approverRoleId,
        approverParentId: a.approverParentId,
        decision: a.decision as never,
        approvalSource: a.approvalSource as never,
        actedAt: a.actedAt,
        createdAt: e.createdAt,
      })),
    );

    await db.insert(leaveApprovals).values(extensionApprovalValues);
  }

  // ── Summary ──
  const summary = new Map<string, number>();
  for (const s of seeds) {
    const key = `${s.leaveTypeCode} | ${s.status}${s.currentStepKey ? ` @ ${s.currentStepKey}` : ""} | ${s.hostelCode}`;
    summary.set(key, (summary.get(key) ?? 0) + 1);
  }

  const byHostel = new Map<string, number>();
  for (const s of seeds) byHostel.set(s.hostelCode, (byHostel.get(s.hostelCode) ?? 0) + 1);

  const overdueCount = seeds.filter((s) => s.requestNumber.includes("-OVERDUE-")).length;
  const extensionByStatus = new Map<string, number>();
  for (const e of extensionSeeds) {
    extensionByStatus.set(e.status, (extensionByStatus.get(e.status) ?? 0) + 1);
  }

  console.log("\n✅ Done!");
  console.log(`   Total leaves: ${seeds.length} (${overdueCount} pending overdue, ${overduePassInserts.length} overdue returns)`);
  console.log(
    `   Overdue-return movement: ${overdueMovementInserts.length} events, ${overdueScanLogInserts.length} scan log(s)`,
  );
  console.log(
    `   Extensions: ${extensionSeeds.length} (${[...extensionByStatus.entries()]
      .map(([s, n]) => `${s}=${n}`)
      .join(", ")})`,
  );
  console.log(`   Per hostel: ${[...byHostel.entries()].map(([h, n]) => `${h} (${n})`).join(", ")}`);
  console.log("\n   Breakdown (leaveType | status @ stage | hostel):");
  for (const [key, count] of [...summary.entries()].sort()) {
    console.log(`     ${key} × ${count}`);
  }
}

main()
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  })
  .finally(() => process.exit());
