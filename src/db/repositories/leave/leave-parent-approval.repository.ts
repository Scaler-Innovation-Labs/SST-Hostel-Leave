import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import {
  leaveApprovalParentDetails,
  leaveApprovals,
  leaveExtensions,
  leaveRequests,
  parents,
  roles,
  students,
  users,
} from "@/db";
import { db } from "@/lib/db";

export type LeaveApproval = InferSelectModel<typeof leaveApprovals>;
export type LeaveApprovalParentDetails = InferSelectModel<typeof leaveApprovalParentDetails>;

export const leaveParentApprovalRepository = {
  async findByParentApprovalToken(
    tokenHash: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<
    (LeaveApproval & {
      parentDetails: LeaveApprovalParentDetails | null;
      approverRoleCode: string | null;
      parentName: string | null;
      parentPhone: string | null;
      studentName: string | null;
      studentRollNumber: string | null;
      leaveRequest: {
        id: string;
        reason: string;
        startAt: Date;
        endAt: Date;
        status: string;
        submittedForm: Record<string, unknown> | null;
      } | null;
      leaveExtension: {
        id: string;
        extensionNumber: number;
        reason: string;
        currentEndAt: Date;
        requestedEndAt: Date;
        status: string;
        submittedForm: Record<string, unknown> | null;
        leaveRequestId: string;
      } | null;
    }) | null
  > {
    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        parentDetails: leaveApprovalParentDetails,
        roleCode: roles.code,
        parentName: parents.name,
        parentPhone: parents.phone,
        studentName: users.fullName,
        studentRollNumber: students.rollNumber,
      })
      .from(leaveApprovals)
      .innerJoin(
        leaveApprovalParentDetails,
        eq(leaveApprovals.id, leaveApprovalParentDetails.approvalId)
      )
      .leftJoin(
        roles,
        eq(leaveApprovals.approverRoleId, roles.id)
      )
      .leftJoin(
        parents,
        eq(parents.id, leaveApprovalParentDetails.parentId)
      )
      .leftJoin(
        leaveRequests,
        eq(leaveApprovals.leaveRequestId, leaveRequests.id)
      )
      .leftJoin(
        leaveExtensions,
        eq(leaveApprovals.leaveExtensionId, leaveExtensions.id)
      )
      .leftJoin(
        students,
        eq(leaveRequests.studentId, students.id)
      )
      .leftJoin(
        users,
        eq(students.userId, users.id)
      )
      .where(eq(leaveApprovalParentDetails.tokenHash, tokenHash))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0]!;
    const leaveRequestId = row.approval.leaveRequestId;
    const leaveExtensionId = row.approval.leaveExtensionId;

    let leaveRequest: {
      id: string;
      reason: string;
      startAt: Date;
      endAt: Date;
      status: string;
      submittedForm: Record<string, unknown> | null;
    } | null = null;
    if (leaveRequestId) {
      const leaveRows = await dbClient
        .select({
          id: leaveRequests.id,
          reason: leaveRequests.reason,
          startAt: leaveRequests.startAt,
          endAt: leaveRequests.endAt,
          status: leaveRequests.status,
          submittedForm: leaveRequests.submittedForm,
        })
        .from(leaveRequests)
        .where(eq(leaveRequests.id, leaveRequestId))
        .limit(1);

      const lr = leaveRows[0];
      if (lr) {
        leaveRequest = {
          ...lr,
          submittedForm: lr.submittedForm as Record<string, unknown> | null,
        };
      }
    }

    let leaveExtension: {
      id: string;
      extensionNumber: number;
      reason: string;
      currentEndAt: Date;
      requestedEndAt: Date;
      status: string;
      submittedForm: Record<string, unknown> | null;
      leaveRequestId: string;
    } | null = null;
    if (leaveExtensionId) {
      const extRows = await dbClient
        .select({
          id: leaveExtensions.id,
          extensionNumber: leaveExtensions.extensionNumber,
          reason: leaveExtensions.reason,
          currentEndAt: leaveExtensions.currentEndAt,
          requestedEndAt: leaveExtensions.requestedEndAt,
          status: leaveExtensions.status,
          submittedForm: leaveExtensions.submittedForm,
          leaveRequestId: leaveExtensions.leaveRequestId,
        })
        .from(leaveExtensions)
        .where(eq(leaveExtensions.id, leaveExtensionId))
        .limit(1);

      const ext = extRows[0];
      if (ext) {
        leaveExtension = {
          ...ext,
          submittedForm: ext.submittedForm as Record<string, unknown> | null,
        };
      }
    }

    return {
      ...row.approval,
      parentDetails: row.parentDetails,
      approverRoleCode: row.roleCode,
      parentName: row.parentName,
      parentPhone: row.parentPhone,
      studentName: row.studentName,
      studentRollNumber: row.studentRollNumber,
      leaveRequest,
      leaveExtension,
    };
  },

  async updateParentApprovalToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
    dbClient: Pick<typeof db, "update"> = db,
    parentId?: string
  ): Promise<LeaveApproval | null> {
    const clientAny = dbClient as any;

    // 1. Verify leave approval is PENDING
    const approvalRows = await clientAny
      .select()
      .from(leaveApprovals)
      .where(
        and(
          eq(leaveApprovals.id, id),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING)
        )
      )
      .limit(1);

    const updatedApproval = approvalRows[0] ?? null;
    if (!updatedApproval) return null;

    // 2. Resolve parentId if not provided
    let resolvedParentId = parentId;
    if (!resolvedParentId) {
      const existingDetails = await clientAny
        .select({ parentId: leaveApprovalParentDetails.parentId })
        .from(leaveApprovalParentDetails)
        .where(eq(leaveApprovalParentDetails.approvalId, id))
        .limit(1);
      resolvedParentId = existingDetails[0]?.parentId;
    }

    if (resolvedParentId && typeof clientAny.insert === "function") {
      await clientAny
        .insert(leaveApprovalParentDetails)
        .values({
          approvalId: id,
          parentId: resolvedParentId,
          tokenHash,
          tokenExpiresAt: expiresAt,
        })
        .onConflictDoUpdate({
          target: leaveApprovalParentDetails.approvalId,
          set: {
            parentId: resolvedParentId,
            tokenHash,
            tokenExpiresAt: expiresAt,
          },
        });
    }

    return updatedApproval;
  },

  async updateParentDecision(
    id: string,
    decision: LeaveApprovalDecision,
    comments: string | undefined,
    dbClient: Pick<typeof db, "update"> = db,
    approvalSource?: string,
  ): Promise<LeaveApproval | null> {
    const rows = await dbClient
      .update(leaveApprovals)
      .set({
        decision,
        comments,
        actedAt: new Date(),
        approvalSource: (approvalSource ?? LEAVE_APPROVAL_SOURCE.SMS) as typeof LEAVE_APPROVAL_SOURCE.SMS,
      })
      .where(
        and(
          eq(leaveApprovals.id, id),
          eq(
            leaveApprovals.decision,
            LEAVE_APPROVAL_DECISION.PENDING
          )
        )
      )
      .returning();

    return rows[0] ?? null;
  },

  async findById(
    id: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<(LeaveApproval & { parentDetails: LeaveApprovalParentDetails | null }) | null> {
    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        parentDetails: leaveApprovalParentDetails,
      })
      .from(leaveApprovals)
      .leftJoin(
        leaveApprovalParentDetails,
        eq(leaveApprovals.id, leaveApprovalParentDetails.approvalId)
      )
      .where(eq(leaveApprovals.id, id))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0]!;
    return {
      ...row.approval,
      parentDetails: row.parentDetails,
    };
  },

  async findPendingByParentPhone(
    phone: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<LeaveApproval & { parentDetails: LeaveApprovalParentDetails | null; leaveRequest: { id: string; reason: string; startAt: Date; endAt: Date; status: string; requestNumber: string } | null; studentName: string | null }>> {
    const parentRows = await dbClient
      .select({ id: parents.id })
      .from(parents)
      .where(eq(parents.phone, phone));

    if (parentRows.length === 0) return [];

    const parentIds = parentRows.map((r) => r.id);

    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        parentDetails: leaveApprovalParentDetails,
        studentName: users.fullName,
        leaveReqId: leaveRequests.id,
        leaveReqReason: leaveRequests.reason,
        leaveReqStartAt: leaveRequests.startAt,
        leaveReqEndAt: leaveRequests.endAt,
        leaveReqStatus: leaveRequests.status,
        leaveReqNumber: leaveRequests.requestNumber,
      })
      .from(leaveApprovals)
      .innerJoin(
        leaveApprovalParentDetails,
        eq(leaveApprovals.id, leaveApprovalParentDetails.approvalId)
      )
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(
        and(
          inArray(leaveApprovalParentDetails.parentId, parentIds),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
          sql`(
            ${leaveApprovalParentDetails.tokenExpiresAt} IS NULL
            OR ${leaveApprovalParentDetails.tokenExpiresAt} > NOW()
          )`
        )
      )
      .orderBy(desc(leaveApprovals.createdAt));

    return rows.map((row) => ({
      ...row.approval,
      parentDetails: row.parentDetails,
      studentName: row.studentName,
      leaveRequest: row.leaveReqId
        ? {
            id: row.leaveReqId,
            reason: row.leaveReqReason ?? "",
            startAt: row.leaveReqStartAt!,
            endAt: row.leaveReqEndAt!,
            status: row.leaveReqStatus ?? "",
            requestNumber: row.leaveReqNumber ?? "",
          }
        : null,
    }));
  },

  async findByParentPhoneAndLeaveRequest(
    phone: string,
    leaveRequestId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<(LeaveApproval & { parentDetails: LeaveApprovalParentDetails | null; studentName: string | null }) | null> {
    const parentRows = await dbClient
      .select({ id: parents.id })
      .from(parents)
      .where(eq(parents.phone, phone));

    if (parentRows.length === 0) return null;

    const parentIds = parentRows.map((r) => r.id);

    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        parentDetails: leaveApprovalParentDetails,
        studentName: users.fullName,
      })
      .from(leaveApprovals)
      .innerJoin(
        leaveApprovalParentDetails,
        eq(leaveApprovals.id, leaveApprovalParentDetails.approvalId)
      )
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(
        and(
          inArray(leaveApprovalParentDetails.parentId, parentIds),
          eq(leaveApprovals.leaveRequestId, leaveRequestId),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
          sql`(
            ${leaveApprovalParentDetails.tokenExpiresAt} IS NULL
            OR ${leaveApprovalParentDetails.tokenExpiresAt} > NOW()
          )`
        )
      )
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0]!;
    return {
      ...row.approval,
      parentDetails: row.parentDetails,
      studentName: row.studentName,
    };
  },

  async findByParentPhoneAndExtensionRequest(
    phone: string,
    extensionId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<(LeaveApproval & { parentDetails: LeaveApprovalParentDetails | null; studentName: string | null }) | null> {
    const parentRows = await dbClient
      .select({ id: parents.id })
      .from(parents)
      .where(eq(parents.phone, phone));

    if (parentRows.length === 0) return null;

    const parentIds = parentRows.map((r) => r.id);

    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        parentDetails: leaveApprovalParentDetails,
        studentName: users.fullName,
      })
      .from(leaveApprovals)
      .innerJoin(
        leaveApprovalParentDetails,
        eq(leaveApprovals.id, leaveApprovalParentDetails.approvalId)
      )
      .leftJoin(leaveExtensions, eq(leaveApprovals.leaveExtensionId, leaveExtensions.id))
      .leftJoin(leaveRequests, eq(leaveExtensions.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(
        and(
          inArray(leaveApprovalParentDetails.parentId, parentIds),
          eq(leaveApprovals.leaveExtensionId, extensionId),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
          sql`(
            ${leaveApprovalParentDetails.tokenExpiresAt} IS NULL
            OR ${leaveApprovalParentDetails.tokenExpiresAt} > NOW()
          )`
        )
      )
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0]!;
    return {
      ...row.approval,
      parentDetails: row.parentDetails,
      studentName: row.studentName,
    };
  },
};

export default leaveParentApprovalRepository;
