import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, like, lte, ne, or, sql } from "drizzle-orm";

import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import type { LeaveRequestStatus } from "@/constants/leave/leave-status";
import {
  academicGroups,
  departments,
  hostels,
  leaveApprovals,
  leaveExtensions,
  leaveRequests,
  leaveTypes,
  parents,
  roles,
  students,
  users,
} from "@/db";
import { db } from "@/lib/db";

type LeaveApprovalDbClient = Pick<
  typeof db,
  "insert" | "select" | "update"
>;

export type LeaveApproval = InferSelectModel<typeof leaveApprovals>;

export type NewLeaveApproval = InferInsertModel<
  typeof leaveApprovals
>;

export const leaveApprovalRepository = {
  async createMany(
    inputs: NewLeaveApproval[],
    dbClient: LeaveApprovalDbClient = db
  ): Promise<LeaveApproval[]> {
    if (inputs.length === 0) {
      return [];
    }

    const rows = await dbClient
      .insert(leaveApprovals)
      .values(inputs)
      .returning();

    return rows;
  },

  async autoApprove(
    id: string,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<LeaveApproval | null> {
    const rows = await dbClient
      .update(leaveApprovals)
      .set({
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        actedAt: new Date(),
        approvalSource: LEAVE_APPROVAL_SOURCE.SYSTEM,
      })
      .where(
        and(
          eq(leaveApprovals.id, id),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING)
        )
      )
      .returning();
    return rows[0] ?? null;
  },

  async findByFilters(
    filters: {
      status?: LeaveApprovalDecision;
      leaveRequestId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      search?: string;
      excludeLeaveStatuses?: LeaveRequestStatus[];
      waitingOn?: string;
      hostelId?: string;
      leaveTypeId?: string;
      approverUserId?: string;
      page: number;
      limit: number;
    },
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<{
    items: Array<
      LeaveApproval & {
        approverRoleCode: string | null;
        leaveRequest: {
          id: string;
          status: string;
          startAt: Date;
          endAt: Date;
          reason: string;
          requestNumber: string;
          submittedForm?: Record<string, unknown> | null;
          currentStepKey?: string | null;
          currentStepOrder?: number | null;
          policyResult?: Record<string, unknown> | null;
        } | null;
        studentName: string | null;
        studentRollNumber: string | null;
        roomNumber: string | null;
        hostelName: string | null;
        departmentName: string | null;
        leaveTypeName: string | null;
      }
    >;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const conditions: ReturnType<typeof and>[] = [];

    if (filters.status) {
      conditions.push(eq(leaveApprovals.decision, filters.status));
    }
    if (filters.leaveRequestId) {
      conditions.push(eq(leaveApprovals.leaveRequestId, filters.leaveRequestId));
    }
    if (filters.dateFrom) {
      conditions.push(gte(leaveApprovals.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(leaveApprovals.createdAt, filters.dateTo));
    }
    if (filters.excludeLeaveStatuses?.length) {
      conditions.push(...filters.excludeLeaveStatuses.map((s) => ne(leaveRequests.status, s)));
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(leaveRequests.requestNumber, searchPattern),
          like(users.fullName, searchPattern)
        )
      );
    }
    if (filters.waitingOn) {
      conditions.push(eq(leaveRequests.currentStepKey, filters.waitingOn));
    }
    if (filters.hostelId) {
      conditions.push(eq(users.hostelId, filters.hostelId));
    }
    if (filters.leaveTypeId) {
      conditions.push(eq(leaveRequests.leaveTypeId, filters.leaveTypeId));
    }

    if (filters.approverUserId) {
      conditions.push(eq(leaveApprovals.approverUserId, filters.approverUserId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await dbClient
      .select({ count: sql<number>`count(DISTINCT ${leaveApprovals.leaveRequestId})` })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / filters.limit);

    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        stepOrder: leaveApprovals.stepOrder,
        roleCode: roles.code,
        leaveReqId: leaveRequests.id,
        leaveReqStatus: leaveRequests.status,
        leaveReqStartAt: leaveRequests.startAt,
        leaveReqEndAt: leaveRequests.endAt,
        leaveReqReason: leaveRequests.reason,
        leaveReqNumber: leaveRequests.requestNumber,
        leaveReqSubmittedForm: leaveRequests.submittedForm,
        leaveReqCurrentStepKey: leaveRequests.currentStepKey,
        leaveReqCurrentStepOrder: leaveRequests.currentStepOrder,
        leaveReqPolicyResult: leaveRequests.policyResult,
        studentName: users.fullName,
        studentRollNumber: students.rollNumber,
        roomNumber: students.roomNumber,
        hostelName: hostels.name,
        departmentName: departments.name,
        leaveTypeName: leaveTypes.name,
      })
      .from(leaveApprovals)
      .leftJoin(roles, eq(leaveApprovals.approverRoleId, roles.id))
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(hostels, eq(users.hostelId, hostels.id))
      .leftJoin(academicGroups, eq(students.academicGroupId, academicGroups.id))
      .leftJoin(departments, eq(academicGroups.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(leaveApprovals.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const seenReqIds = new Set<string>();
    const dedupedRows = rows
      .sort((a, b) => {
        const aCurrent = a.leaveReqCurrentStepKey === a.approval.stepKey ? 0 : 1;
        const bCurrent = b.leaveReqCurrentStepKey === b.approval.stepKey ? 0 : 1;
        if (aCurrent !== bCurrent) return aCurrent - bCurrent;
        return (a.stepOrder ?? 999) - (b.stepOrder ?? 999);
      })
      .filter((row) => {
        if (!row.leaveReqId) return true;
        if (seenReqIds.has(row.leaveReqId)) return false;
        seenReqIds.add(row.leaveReqId);
        return true;
      });

    return {
      items: dedupedRows.map((row) => ({
        ...row.approval,
        approverRoleCode: row.roleCode,
        leaveRequest: row.leaveReqId
          ? {
              id: row.leaveReqId,
              status: row.leaveReqStatus ?? "",
              startAt: row.leaveReqStartAt!,
              endAt: row.leaveReqEndAt!,
              reason: row.leaveReqReason ?? "",
              requestNumber: row.leaveReqNumber ?? "",
              submittedForm: row.leaveReqSubmittedForm as Record<string, unknown> | null ?? null,
              currentStepKey: row.leaveReqCurrentStepKey ?? null,
              currentStepOrder: row.leaveReqCurrentStepOrder ?? null,
              policyResult: row.leaveReqPolicyResult as Record<string, unknown> | null ?? null,
            }
          : null,
        studentName: row.studentName,
        studentRollNumber: row.studentRollNumber,
        roomNumber: row.roomNumber,
        hostelName: row.hostelName,
        departmentName: row.departmentName,
        leaveTypeName: row.leaveTypeName,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
    };
  },

  async findByEntityAndDecision(
    entityId: string,
    column: typeof leaveApprovals.leaveRequestId | typeof leaveApprovals.leaveExtensionId,
    decision: LeaveApprovalDecision,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<
    Array<
      LeaveApproval & {
        approverRoleCode: string | null;
      }
    >
  > {
    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        roleCode: roles.code,
      })
      .from(leaveApprovals)
      .leftJoin(
        roles,
        eq(
          leaveApprovals.approverRoleId,
          roles.id
        )
      )
      .where(
        and(
          eq(column, entityId),
          eq(
            leaveApprovals.decision,
            decision
          )
        )
      )
      .orderBy(leaveApprovals.stepOrder);

    return rows.map((row) => ({
      ...row.approval,
      approverRoleCode: row.roleCode,
    }));
  },

  async findNextByEntityAndDecision(
    entityId: string,
    column: typeof leaveApprovals.leaveRequestId | typeof leaveApprovals.leaveExtensionId,
    currentStepOrder: number,
    decision: LeaveApprovalDecision,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<LeaveApproval | null> {
    const rows = await dbClient
      .select()
      .from(leaveApprovals)
      .where(
        and(
          eq(column, entityId),
          gt(
            leaveApprovals.stepOrder,
            currentStepOrder
          ),
          eq(
            leaveApprovals.decision,
            decision
          )
        )
      )
      .orderBy(leaveApprovals.stepOrder)
      .limit(1);

    return rows[0] ?? null;
  },

  async updateDecisionByLeaveRequestId(
    leaveRequestId: string,
    decision: LeaveApprovalDecision,
    actedAt: Date,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<LeaveApproval[]> {
    const rows = await dbClient
      .update(leaveApprovals)
      .set({
        decision,
        actedAt,
      })
      .where(
        and(
          eq(leaveApprovals.leaveRequestId, leaveRequestId),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING)
        )
      )
      .returning();

    return rows;
  },

  async updateDecisionById(
    id: string,
    decision: LeaveApprovalDecision,
    approverUserId: string | null,
    comments: string | undefined,
    actedAt: Date,
    dbClient: Pick<typeof db, "update"> = db,
    approvalSource?: string,
  ): Promise<LeaveApproval | null> {
    const setData: Record<string, unknown> = {
      decision,
      approverUserId,
      comments,
      actedAt,
    };

    if (approvalSource) {
      setData.approvalSource = approvalSource;
    }

    const rows = await dbClient
      .update(leaveApprovals)
      .set(setData as any)
      .where(
  and(
    eq(
      leaveApprovals.id,
      id
    ),
    eq(
      leaveApprovals.decision,
      LEAVE_APPROVAL_DECISION.PENDING
    )
  )
)
      .returning();

    return rows[0] ?? null;
  },

  async findExtensionApprovals(
    filters: {
      status?: LeaveApprovalDecision;
      search?: string;
      page: number;
      limit: number;
    },
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<{
    items: Array<
      LeaveApproval & {
        approverRoleCode: string | null;
        extension: {
          id: string;
          extensionNumber: number;
          reason: string;
          status: string;
          requestedEndAt: Date;
          currentEndAt: Date;
        } | null;
        leaveRequest: {
          id: string;
          status: string;
          requestNumber: string;
        } | null;
        studentName: string | null;
        studentRollNumber: string | null;
      }
    >;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const conditions: ReturnType<typeof and>[] = [
      isNotNull(leaveApprovals.leaveExtensionId),
      isNull(leaveApprovals.approverParentId),
    ];

    if (filters.status) {
      conditions.push(eq(leaveApprovals.decision, filters.status));
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(leaveRequests.requestNumber, searchPattern),
          like(users.fullName, searchPattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveApprovals)
      .innerJoin(leaveExtensions, eq(leaveApprovals.leaveExtensionId, leaveExtensions.id))
      .leftJoin(leaveRequests, eq(leaveExtensions.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / filters.limit);

    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        roleCode: roles.code,
        extId: leaveExtensions.id,
        extNumber: leaveExtensions.extensionNumber,
        extReason: leaveExtensions.reason,
        extStatus: leaveExtensions.status,
        extRequestedEndAt: leaveExtensions.requestedEndAt,
        extCurrentEndAt: leaveExtensions.currentEndAt,
        leaveReqId: leaveRequests.id,
        leaveReqStatus: leaveRequests.status,
        leaveReqNumber: leaveRequests.requestNumber,
        studentName: users.fullName,
        studentRollNumber: students.rollNumber,
      })
      .from(leaveApprovals)
      .leftJoin(roles, eq(leaveApprovals.approverRoleId, roles.id))
      .innerJoin(leaveExtensions, eq(leaveApprovals.leaveExtensionId, leaveExtensions.id))
      .leftJoin(leaveRequests, eq(leaveExtensions.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(whereClause)
      .orderBy(desc(leaveApprovals.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      items: rows.map((row) => ({
        ...row.approval,
        approverRoleCode: row.roleCode,
        extension: row.extId
          ? {
              id: row.extId,
              extensionNumber: row.extNumber ?? 0,
              reason: row.extReason ?? "",
              status: row.extStatus ?? "",
              requestedEndAt: row.extRequestedEndAt!,
              currentEndAt: row.extCurrentEndAt!,
            }
          : null,
        leaveRequest: row.leaveReqId
          ? {
              id: row.leaveReqId,
              status: row.leaveReqStatus ?? "",
              requestNumber: row.leaveReqNumber ?? "",
            }
          : null,
        studentName: row.studentName,
        studentRollNumber: row.studentRollNumber,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
    };
  },

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

  async findById(
    id: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<LeaveApproval | null> {
    const rows = await dbClient
      .select()
      .from(leaveApprovals)
      .where(eq(leaveApprovals.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async countRecent(
    since: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveApprovals)
      .where(gte(leaveApprovals.createdAt, since));

    return Number(result[0]?.count ?? 0);
  },

  async averageApprovalTime(
    since: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number | null> {
    const result = await dbClient
      .select({
        avgHours: sql<number>`EXTRACT(EPOCH FROM AVG(${leaveApprovals.actedAt} - ${leaveApprovals.createdAt})) / 3600`,
      })
      .from(leaveApprovals)
      .where(
        and(
          gte(leaveApprovals.createdAt, since),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.APPROVED),
          sql`${leaveApprovals.actedAt} IS NOT NULL`
        )
      );

    const avg = result[0]?.avgHours;
    return avg != null ? Math.round(avg * 10) / 10 : null;
  },

  async countByDateRange(
    startDate: Date,
    endDate: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; count: number }>> {
    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${leaveApprovals.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(leaveApprovals)
      .where(
        and(
          gte(leaveApprovals.createdAt, startDate),
          lte(leaveApprovals.createdAt, endDate),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.APPROVED)
        )
      )
      .groupBy(sql`DATE(${leaveApprovals.createdAt})`)
      .orderBy(sql`DATE(${leaveApprovals.createdAt})`);

    return rows;
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

  async findByLeaveRequestId(
    leaveRequestId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<LeaveApproval[]> {
    return await dbClient
      .select()
      .from(leaveApprovals)
      .where(eq(leaveApprovals.leaveRequestId, leaveRequestId))
      .orderBy(leaveApprovals.stepOrder);
  },

  async countByDecision(
    decision: LeaveApprovalDecision,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveApprovals)
      .where(eq(leaveApprovals.decision, decision));
    return Number(result[0]?.count ?? 0);
  },
};

export default leaveApprovalRepository;