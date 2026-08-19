import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, like, lte, ne, or, sql } from "drizzle-orm";

import type { LeaveApprovalSource } from "@/constants/leave/approval-source";
import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS, type LeaveRequestStatus } from "@/constants/leave/leave-status";
import {
  academicGroups,
  departments,
  hostels,
  leaveApprovals,
  leaveExecutionContexts,
  leaveExtensions,
  leaveRequests,
  leaveTypes,
  leaveTypeVersions,
  parents,
  roles,
  students,
  users,
  workflowSteps,
  workflowVersions,
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

/** Shape of a frozen workflow step inside workflow_versions.steps. */
type FrozenWorkflowStep = {
  stepKey: string;
  stepOrder: number;
  approverRoleCode: string | null;
  isParentApproval: boolean;
  approvalMethod: string | null;
  isRequired?: boolean;
};

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
      /** Restrict to students whose user belongs to one of these hostels. */
      hostelIds?: string[];
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
        leaveTypeUiConfig: Record<string, unknown> | null;
        workflowSteps: Array<{
          stepKey: string;
          stepOrder: number;
          approverRoleCode: string | null;
          isParentApproval: boolean | null;
          approvalMethod: string | null;
        }>;
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
    if (filters.hostelIds?.length) {
      conditions.push(inArray(users.hostelId, filters.hostelIds));
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
        leaveTypeUiConfig: leaveTypes.uiConfig,
        leaveTypeDefaultWorkflowId: leaveTypes.defaultWorkflowId,
        execLeaveTypeName: leaveTypeVersions.name,
        execUiConfig: leaveTypeVersions.uiConfig,
        execWorkflowSteps: workflowVersions.steps,
      })
      .from(leaveApprovals)
      .leftJoin(roles, eq(leaveApprovals.approverRoleId, roles.id))
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .leftJoin(leaveExecutionContexts, eq(leaveRequests.id, leaveExecutionContexts.leaveRequestId))
      .leftJoin(leaveTypeVersions, eq(leaveExecutionContexts.leaveTypeVersionId, leaveTypeVersions.id))
      .leftJoin(workflowVersions, eq(leaveExecutionContexts.workflowVersionId, workflowVersions.id))
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

    // Load the configured approval chain for each affected workflow so the UI
    // can render only the steps that actually exist for that leave type.
    const workflowIds = [
      ...new Set(
        dedupedRows
          .map((row) => row.leaveTypeDefaultWorkflowId)
          .filter((id): id is string => !!id)
      ),
    ];

    const stepsByWorkflow = new Map<
      string,
      Array<{
        stepKey: string;
        stepOrder: number;
        approverRoleCode: string | null;
        isParentApproval: boolean | null;
        approvalMethod: string | null;
      }>
    >();

    if (workflowIds.length > 0) {
      const workflowStepRows = await dbClient
        .select({
          workflowDefinitionId: workflowSteps.workflowDefinitionId,
          stepKey: workflowSteps.stepKey,
          stepOrder: workflowSteps.stepOrder,
          isParentApproval: workflowSteps.isParentApproval,
          approvalMethod: workflowSteps.approvalMethod,
          approverRoleCode: roles.code,
        })
        .from(workflowSteps)
        .leftJoin(roles, eq(workflowSteps.approverRoleId, roles.id))
        .where(inArray(workflowSteps.workflowDefinitionId, workflowIds))
        .orderBy(asc(workflowSteps.stepOrder));

      for (const step of workflowStepRows) {
        const list = stepsByWorkflow.get(step.workflowDefinitionId) ?? [];
        list.push({
          stepKey: step.stepKey,
          stepOrder: step.stepOrder,
          approverRoleCode: step.approverRoleCode,
          isParentApproval: step.isParentApproval,
          approvalMethod: step.approvalMethod,
        });
        stepsByWorkflow.set(step.workflowDefinitionId, list);
      }
    }

    return {
      items: dedupedRows.map((row) => ({
        ...row.approval,
        approverRoleCode: row.roleCode,
        // Prefer the frozen steps from the leave's execution context (what
        // the chain actually was at submission time); fall back to the live
        // workflow for legacy leaves without a context.
        workflowSteps:
          (row.execWorkflowSteps as FrozenWorkflowStep[] | null) ??
          stepsByWorkflow.get(row.leaveTypeDefaultWorkflowId ?? "") ?? [],
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
        leaveTypeName: row.execLeaveTypeName ?? row.leaveTypeName,
        leaveTypeUiConfig: (row.execUiConfig ?? row.leaveTypeUiConfig) as Record<string, unknown> | null ?? null,
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
    rejectionCategory?: string,
  ): Promise<LeaveApproval | null> {
    const setData: Partial<InferInsertModel<typeof leaveApprovals>> = {
      decision,
      approverUserId,
      comments,
      actedAt,
    };

    if (approvalSource) {
      setData.approvalSource = approvalSource as LeaveApprovalSource;
    }

    if (rejectionCategory) {
      setData.rejectionCategory = rejectionCategory;
    }

    const rows = await dbClient
      .update(leaveApprovals)
      .set(setData)
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
      /** Filters on the extension's own status (LEAVE_REQUEST_STATUS). */
      status?: LeaveRequestStatus;
      search?: string;
      /** Restrict to extensions whose parent leave is waiting on this step. */
      waitingOn?: string;
      hostelId?: string;
      /** Restrict to students whose user belongs to one of these hostels. */
      hostelIds?: string[];
      leaveTypeId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      page: number;
      limit: number;
    },
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<{
    items: Array<
      LeaveApproval & {
        approverRoleCode: string | null;
        workflowSteps: Array<{
          stepKey: string;
          stepOrder: number;
          approverRoleCode: string | null;
          isParentApproval: boolean | null;
          approvalMethod: string | null;
        }>;
        leaveTypeName: string | null;
        leaveTypeUiConfig: Record<string, unknown> | null;
        roomNumber: string | null;
        hostelName: string | null;
        departmentName: string | null;
        studentName: string | null;
        studentRollNumber: string | null;
        parentName: string | null;
        parentPhone: string | null;
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
      }
    >;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    /** Counts of distinct extensions scoped to the same authorization/hostel scope as the list (no status/search filter). */
    stats: { total: number; pending: number; approved: number; rejected: number };
  }> {
    const scopeConditions: ReturnType<typeof and>[] = [
      isNotNull(leaveApprovals.leaveExtensionId),
    ];

    if (filters.hostelId) {
      scopeConditions.push(eq(users.hostelId, filters.hostelId));
    }
    if (filters.hostelIds?.length) {
      scopeConditions.push(inArray(users.hostelId, filters.hostelIds));
    }

    const conditions = [...scopeConditions];

    if (filters.status) {
      conditions.push(eq(leaveExtensions.status, filters.status));
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
      conditions.push(eq(leaveExtensions.currentStepKey, filters.waitingOn));
    }
    if (filters.leaveTypeId) {
      conditions.push(eq(leaveRequests.leaveTypeId, filters.leaveTypeId));
    }
    if (filters.dateFrom) {
      conditions.push(gte(leaveApprovals.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(leaveApprovals.createdAt, filters.dateTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const scopeWhereClause = scopeConditions.length > 0 ? and(...scopeConditions) : undefined;

    const countResult = await dbClient
      .select({ count: sql<number>`count(DISTINCT ${leaveApprovals.leaveExtensionId})` })
      .from(leaveApprovals)
      .innerJoin(leaveExtensions, eq(leaveApprovals.leaveExtensionId, leaveExtensions.id))
      .leftJoin(leaveRequests, eq(leaveExtensions.leaveRequestId, leaveRequests.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / filters.limit);

    // Stats are distinct-extension counts by extension status, scoped only.
    const statsRows = await dbClient
      .select({ status: leaveExtensions.status, count: sql<number>`count(DISTINCT ${leaveApprovals.leaveExtensionId})` })
      .from(leaveApprovals)
      .innerJoin(leaveExtensions, eq(leaveApprovals.leaveExtensionId, leaveExtensions.id))
      .leftJoin(leaveRequests, eq(leaveExtensions.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(scopeWhereClause)
      .groupBy(leaveExtensions.status);

    const countsByStatus = new Map(
      statsRows.map((row) => [row.status, Number(row.count ?? 0)])
    );
    const statsTotal = [...countsByStatus.values()].reduce((sum, c) => sum + c, 0);
    const stats = {
      total: statsTotal,
      pending: countsByStatus.get(LEAVE_REQUEST_STATUS.PENDING) ?? 0,
      approved: countsByStatus.get(LEAVE_REQUEST_STATUS.APPROVED) ?? 0,
      rejected: countsByStatus.get(LEAVE_REQUEST_STATUS.REJECTED) ?? 0,
    };

    const rows = await dbClient
      .select({
        approval: leaveApprovals,
        roleCode: roles.code,
        extId: leaveExtensions.id,
        extReason: leaveExtensions.reason,
        extStatus: leaveExtensions.status,
        extCurrentStepKey: leaveExtensions.currentStepKey,
        extCurrentStepOrder: leaveExtensions.currentStepOrder,
        extPolicyResult: leaveExtensions.policyResult,
        extSubmittedForm: leaveExtensions.submittedForm,
        leaveReqId: leaveRequests.id,
        leaveReqStatus: leaveRequests.status,
        leaveReqStartAt: leaveRequests.startAt,
        leaveReqEndAt: leaveRequests.endAt,
        leaveReqReason: leaveRequests.reason,
        leaveReqNumber: leaveRequests.requestNumber,
        leaveReqSubmittedForm: leaveRequests.submittedForm,
        leaveReqPolicyResult: leaveRequests.policyResult,
        leaveTypeName: leaveTypes.name,
        leaveTypeUiConfig: leaveTypes.uiConfig,
        leaveTypeDefaultWorkflowId: leaveTypes.defaultWorkflowId,
        execLeaveTypeName: leaveTypeVersions.name,
        execUiConfig: leaveTypeVersions.uiConfig,
        execWorkflowSteps: workflowVersions.steps,
        studentName: users.fullName,
        studentRollNumber: students.rollNumber,
        roomNumber: students.roomNumber,
        hostelName: hostels.name,
        departmentName: departments.name,
        parentName: parents.name,
        parentPhone: parents.phone,
      })
      .from(leaveApprovals)
      .leftJoin(roles, eq(leaveApprovals.approverRoleId, roles.id))
      .innerJoin(leaveExtensions, eq(leaveApprovals.leaveExtensionId, leaveExtensions.id))
      .leftJoin(leaveRequests, eq(leaveExtensions.leaveRequestId, leaveRequests.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .leftJoin(leaveExecutionContexts, eq(leaveRequests.id, leaveExecutionContexts.leaveRequestId))
      .leftJoin(leaveTypeVersions, eq(leaveExecutionContexts.leaveTypeVersionId, leaveTypeVersions.id))
      .leftJoin(workflowVersions, eq(leaveExecutionContexts.workflowVersionId, workflowVersions.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(hostels, eq(users.hostelId, hostels.id))
      .leftJoin(academicGroups, eq(students.academicGroupId, academicGroups.id))
      .leftJoin(departments, eq(academicGroups.departmentId, departments.id))
      .leftJoin(parents, eq(leaveApprovals.approverParentId, parents.id))
      .where(whereClause)
      .orderBy(desc(leaveApprovals.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    // One card per extension: prefer the row that matches the extension's
    // current step (like findByFilters does for leaves), then the lowest step.
    const seenExtIds = new Set<string>();
    const dedupedRows = rows
      .sort((a, b) => {
        const aCurrent = a.extCurrentStepKey === a.approval.stepKey ? 0 : 1;
        const bCurrent = b.extCurrentStepKey === b.approval.stepKey ? 0 : 1;
        if (aCurrent !== bCurrent) return aCurrent - bCurrent;
        return (a.approval.stepOrder ?? 999) - (b.approval.stepOrder ?? 999);
      })
      .filter((row) => {
        if (!row.extId) return true;
        if (seenExtIds.has(row.extId)) return false;
        seenExtIds.add(row.extId);
        return true;
      });

    // Load the configured approval chain for each affected workflow so the UI
    // can render only the steps that actually exist for that leave type.
    const workflowIds = [
      ...new Set(
        dedupedRows
          .map((row) => row.leaveTypeDefaultWorkflowId)
          .filter((id): id is string => !!id)
      ),
    ];

    const stepsByWorkflow = new Map<
      string,
      Array<{
        stepKey: string;
        stepOrder: number;
        approverRoleCode: string | null;
        isParentApproval: boolean | null;
        approvalMethod: string | null;
      }>
    >();

    if (workflowIds.length > 0) {
      const workflowStepRows = await dbClient
        .select({
          workflowDefinitionId: workflowSteps.workflowDefinitionId,
          stepKey: workflowSteps.stepKey,
          stepOrder: workflowSteps.stepOrder,
          isParentApproval: workflowSteps.isParentApproval,
          approvalMethod: workflowSteps.approvalMethod,
          approverRoleCode: roles.code,
        })
        .from(workflowSteps)
        .leftJoin(roles, eq(workflowSteps.approverRoleId, roles.id))
        .where(inArray(workflowSteps.workflowDefinitionId, workflowIds))
        .orderBy(asc(workflowSteps.stepOrder));

      for (const step of workflowStepRows) {
        const list = stepsByWorkflow.get(step.workflowDefinitionId) ?? [];
        list.push({
          stepKey: step.stepKey,
          stepOrder: step.stepOrder,
          approverRoleCode: step.approverRoleCode,
          isParentApproval: step.isParentApproval,
          approvalMethod: step.approvalMethod,
        });
        stepsByWorkflow.set(step.workflowDefinitionId, list);
      }
    }

    return {
      items: dedupedRows.map((row) => ({
        ...row.approval,
        approverRoleCode: row.roleCode,
        // Frozen steps from the parent leave's execution context; fall back
        // to the live workflow for legacy leaves without a context.
        workflowSteps:
          (row.execWorkflowSteps as FrozenWorkflowStep[] | null) ??
          stepsByWorkflow.get(row.leaveTypeDefaultWorkflowId ?? "") ?? [],
        leaveTypeName: row.execLeaveTypeName ?? row.leaveTypeName,
        leaveTypeUiConfig:
          (row.execUiConfig ?? row.leaveTypeUiConfig) as Record<string, unknown> | null ?? null,
        roomNumber: row.roomNumber,
        hostelName: row.hostelName,
        departmentName: row.departmentName,
        studentName: row.studentName,
        studentRollNumber: row.studentRollNumber,
        parentName: row.parentName,
        parentPhone: row.parentPhone,
        leaveRequest: row.leaveReqId
          ? {
              id: row.leaveReqId,
              // The card's progress/status logic keys off the request status,
              // so surface the extension's own status and current step here.
              status: row.extStatus ?? row.leaveReqStatus ?? "",
              startAt: row.leaveReqStartAt!,
              endAt: row.leaveReqEndAt!,
              reason: row.extReason ?? row.leaveReqReason ?? "",
              requestNumber: row.leaveReqNumber ?? "",
              submittedForm:
                (row.extSubmittedForm as Record<string, unknown> | null) ??
                (row.leaveReqSubmittedForm as Record<string, unknown> | null) ??
                null,
              currentStepKey: row.extCurrentStepKey ?? null,
              currentStepOrder: row.extCurrentStepOrder ?? null,
              policyResult:
                (row.extPolicyResult as Record<string, unknown> | null) ??
                (row.leaveReqPolicyResult as Record<string, unknown> | null) ??
                null,
            }
          : null,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
      stats,
    };
  },

  // parent methods moved to leave-parent-approval.repository

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

  // analytics methods moved to leave-approval-analytics.repository

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

};

export default leaveApprovalRepository;