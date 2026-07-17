import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import {
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

export const leaveParentApprovalRepository = {
  async findByParentApprovalToken(
    tokenHash: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<
    (LeaveApproval & {
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
        roleCode: roles.code,
        parentName: parents.name,
        parentPhone: parents.phone,
        studentName: users.fullName,
        studentRollNumber: students.rollNumber,
      })
      .from(leaveApprovals)
      .leftJoin(
        roles,
        eq(leaveApprovals.approverRoleId, roles.id)
      )
      .leftJoin(
        parents,
        eq(leaveApprovals.approverParentId, parents.id)
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
      .where(
        eq(leaveApprovals.parentApprovalToken, tokenHash)
      )
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
      approverRoleCode: row.roleCode,
      parentName: row.parentName,
      parentPhone: row.parentPhone,
      studentName: row.studentName,
      studentRollNumber: row.studentRollNumber,
      leaveRequest,
      leaveExtension,
    };
  },

  async updateParentApprovalOtp(
    id: string,
    otpHash: string,
    expiresAt: Date,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<LeaveApproval | null> {
    const rows = await dbClient
      .update(leaveApprovals)
      .set({
        parentApprovalOtpHash: otpHash,
        parentApprovalExpiresAt: expiresAt,
      })
      .where(eq(leaveApprovals.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async updateParentApprovalToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<LeaveApproval | null> {
    const rows = await dbClient
      .update(leaveApprovals)
      .set({
        parentApprovalToken: tokenHash,
        parentApprovalExpiresAt: expiresAt,
      })
      .where(eq(leaveApprovals.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async updateParentApprovalVerified(
    id: string,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<LeaveApproval | null> {
    const rows = await dbClient
      .update(leaveApprovals)
      .set({
        parentApprovalVerifiedAt: new Date(),
      })
      .where(eq(leaveApprovals.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async updateParentDecision(
    id: string,
    approverParentId: string,
    decision: LeaveApprovalDecision,
    comments: string | undefined,
    dbClient: Pick<typeof db, "update"> = db,
    approvalSource?: string,
  ): Promise<LeaveApproval | null> {
    const rows = await dbClient
      .update(leaveApprovals)
      .set({
        decision,
        approverParentId,
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

  async findPendingByParentId(
    parentId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<LeaveApproval & { studentName: string | null; leaveRequest: { id: string; reason: string; startAt: Date; endAt: Date } | null }>> {
    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        studentName: users.fullName,
        leaveReqId: leaveRequests.id,
        leaveReqReason: leaveRequests.reason,
        leaveReqStartAt: leaveRequests.startAt,
        leaveReqEndAt: leaveRequests.endAt,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(
        and(
          eq(leaveApprovals.approverParentId, parentId),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING)
        )
      )
      .orderBy(desc(leaveApprovals.createdAt));

    return rows.map((row) => ({
      ...row.approval,
      studentName: row.studentName,
      leaveRequest: row.leaveReqId
        ? {
            id: row.leaveReqId,
            reason: row.leaveReqReason ?? "",
            startAt: row.leaveReqStartAt!,
            endAt: row.leaveReqEndAt!,
          }
        : null,
    }));
  },

  async findHistoryByParentId(
    parentId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<LeaveApproval & { studentName: string | null; leaveRequest: { id: string; reason: string; startAt: Date; endAt: Date } | null }>> {
    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        studentName: users.fullName,
        leaveReqId: leaveRequests.id,
        leaveReqReason: leaveRequests.reason,
        leaveReqStartAt: leaveRequests.startAt,
        leaveReqEndAt: leaveRequests.endAt,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(
        and(
          eq(leaveApprovals.approverParentId, parentId),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.APPROVED)
        )
      )
      .orderBy(desc(leaveApprovals.actedAt));

    return rows.map((row) => ({
      ...row.approval,
      studentName: row.studentName,
      leaveRequest: row.leaveReqId
        ? {
            id: row.leaveReqId,
            reason: row.leaveReqReason ?? "",
            startAt: row.leaveReqStartAt!,
            endAt: row.leaveReqEndAt!,
          }
        : null,
    }));
  },

  async findPendingByParentPhone(
    phone: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<LeaveApproval & { leaveRequest: { id: string; reason: string; startAt: Date; endAt: Date; status: string; requestNumber: string } | null; studentName: string | null }>> {
    const parentRows = await dbClient
      .select({ id: parents.id })
      .from(parents)
      .where(eq(parents.phone, phone));

    if (parentRows.length === 0) return [];

    const parentIds = parentRows.map((r) => r.id);

    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        studentName: users.fullName,
        leaveReqId: leaveRequests.id,
        leaveReqReason: leaveRequests.reason,
        leaveReqStartAt: leaveRequests.startAt,
        leaveReqEndAt: leaveRequests.endAt,
        leaveReqStatus: leaveRequests.status,
        leaveReqNumber: leaveRequests.requestNumber,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(
        and(
          inArray(leaveApprovals.approverParentId, parentIds),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
          sql`(${leaveApprovals.parentApprovalExpiresAt} IS NULL OR ${leaveApprovals.parentApprovalExpiresAt} > NOW())`
        )
      )
      .orderBy(desc(leaveApprovals.createdAt));

    return rows.map((row) => ({
      ...row.approval,
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

  async countByParentIdAndDecision(
    parentId: string,
    decision: LeaveApprovalDecision,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveApprovals)
      .where(
        and(
          eq(leaveApprovals.approverParentId, parentId),
          eq(leaveApprovals.decision, decision)
        )
      );

    return Number(result[0]?.count ?? 0);
  },
};

export default leaveParentApprovalRepository;
