import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  like,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import type { LeaveApprovalSource } from "@/constants/leave/approval-source";
import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import {
  LEAVE_REQUEST_STATUS,
  type LeaveRequestStatus,
} from "@/constants/leave/leave-status";
import {
  academicGroups,
  departments,
  hostels,
  leaveApprovals,
  leaveConfigurationContexts,
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
import type { ApprovalStepBreakdownEntry } from "@/types/leave/approval-step-breakdown";

type LeaveApprovalDbClient = Pick<typeof db, "insert" | "select" | "update">;

export type LeaveApproval = InferSelectModel<typeof leaveApprovals>;

export type NewLeaveApproval = InferInsertModel<typeof leaveApprovals>;

/** Shape of a frozen workflow step inside workflow_versions.steps. */
type FrozenWorkflowStep = {
  stepKey: string;
  stepOrder: number;
  approverRoleCode: string | null;
  isParentApproval: boolean;
  approvalMethod: string | null;
  isRequired?: boolean;
};

/** How an approval row locates itself against its entity's approval chain. */
type StepPosition = {
  entityId: string | null;
  stepKey: string;
  stepOrder: number;
  currentStepKey: string | null;
};

/** Turns grouped `current_step_key` counts into the queue's waiting-on facet. */
function toStepBreakdown(
  rows: Array<{ stepKey: string | null; count: number }>,
): ApprovalStepBreakdownEntry[] {
  return rows.flatMap((row) =>
    row.stepKey
      ? [{ stepKey: row.stepKey, count: Number(row.count ?? 0) }]
      : [],
  );
}

/**
 * Collapses an entity's approval rows to the one the queue card represents:
 * the row sitting at the entity's current step, else its earliest step.
 *
 * `entityIds` carries the page's sort order, so the result comes back in it.
 */
function pickCurrentStepRow<TRow>(
  rows: TRow[],
  entityIds: string[],
  position: (row: TRow) => StepPosition,
): TRow[] {
  const isBefore = (
    candidate: StepPosition,
    incumbent: StepPosition,
  ): boolean => {
    const candidateIsCurrent = candidate.currentStepKey === candidate.stepKey;
    const incumbentIsCurrent = incumbent.currentStepKey === incumbent.stepKey;
    if (candidateIsCurrent !== incumbentIsCurrent) return candidateIsCurrent;
    return candidate.stepOrder < incumbent.stepOrder;
  };

  const chosen = new Map<string, TRow>();
  for (const row of rows) {
    const candidate = position(row);
    if (!candidate.entityId) continue;
    const incumbent = chosen.get(candidate.entityId);
    if (!incumbent || isBefore(candidate, position(incumbent))) {
      chosen.set(candidate.entityId, row);
    }
  }

  return entityIds.flatMap((id) => {
    const row = chosen.get(id);
    return row ? [row] : [];
  });
}

/**
 * The configured approval chain per workflow, so a queue card can render the
 * steps that actually exist for its leave type.
 */
async function loadWorkflowSteps(
  workflowIds: string[],
  dbClient: Pick<typeof db, "select">,
): Promise<
  Map<
    string,
    Array<{
      stepKey: string;
      stepOrder: number;
      approverRoleCode: string | null;
      isParentApproval: boolean | null;
      approvalMethod: string | null;
    }>
  >
> {
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

  if (workflowIds.length === 0) return stepsByWorkflow;

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

  return stepsByWorkflow;
}

export const leaveApprovalRepository = {
  async createMany(
    inputs: NewLeaveApproval[],
    dbClient: LeaveApprovalDbClient = db,
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
    dbClient: Pick<typeof db, "update"> = db,
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
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },

  async findByFilters(
    filters: {
      status?: LeaveApprovalDecision;
      /** Filter by the leave request lifecycle status shown on queue cards. */
      leaveStatus?: LeaveRequestStatus;
      leaveRequestId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      search?: string;
      excludeLeaveStatuses?: LeaveRequestStatus[];
      waitingOn?: string;
      hostelId?: string;
      /** Restrict to students whose user belongs to one of these hostels. */
      hostelIds?: string[];
      /** Restrict to a single student's leave requests. */
      studentId?: string;
      leaveTypeId?: string;
      approverUserId?: string;
      /**
       * Queue mode (the default): one row per leave request, paginated over
       * requests. Pass false to get every matching approval row instead —
       * the full approval chain of a single leave.
       */
      groupByLeaveRequest?: boolean;
      page: number;
      limit: number;
    },
    dbClient: Pick<typeof db, "select"> = db,
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
    stepBreakdown: ApprovalStepBreakdownEntry[];
  }> {
    const groupByLeaveRequest = filters.groupByLeaveRequest ?? true;
    const offset = (filters.page - 1) * filters.limit;

    // Everything except the waiting-on filter. The step breakdown has to be
    // counted over this set: counting it over the filtered rows would make
    // the chips describe their own output.
    const baseConditions: ReturnType<typeof and>[] = [
      isNotNull(leaveApprovals.leaveRequestId),
    ];

    if (filters.status) {
      baseConditions.push(eq(leaveApprovals.decision, filters.status));
    }
    if (filters.leaveStatus) {
      baseConditions.push(eq(leaveRequests.status, filters.leaveStatus));
    }
    if (filters.leaveRequestId) {
      baseConditions.push(
        eq(leaveApprovals.leaveRequestId, filters.leaveRequestId),
      );
    }
    if (filters.studentId) {
      baseConditions.push(eq(leaveRequests.studentId, filters.studentId));
    }
    if (filters.dateFrom) {
      baseConditions.push(gte(leaveApprovals.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      baseConditions.push(lte(leaveApprovals.createdAt, filters.dateTo));
    }
    if (filters.excludeLeaveStatuses?.length) {
      baseConditions.push(
        ...filters.excludeLeaveStatuses.map((s) => ne(leaveRequests.status, s)),
      );
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      baseConditions.push(
        or(
          like(leaveRequests.requestNumber, searchPattern),
          like(users.fullName, searchPattern),
        ),
      );
    }
    if (filters.hostelId) {
      baseConditions.push(eq(users.hostelId, filters.hostelId));
    }
    if (filters.hostelIds?.length) {
      baseConditions.push(inArray(users.hostelId, filters.hostelIds));
    }
    if (filters.leaveTypeId) {
      baseConditions.push(eq(leaveRequests.leaveTypeId, filters.leaveTypeId));
    }
    if (filters.approverUserId) {
      baseConditions.push(
        eq(leaveApprovals.approverUserId, filters.approverUserId),
      );
    }

    const whereClause = filters.waitingOn
      ? and(
          ...baseConditions,
          eq(leaveRequests.currentStepKey, filters.waitingOn),
        )
      : and(...baseConditions);

    const countResult = await dbClient
      .select({
        count: groupByLeaveRequest
          ? sql<number>`count(DISTINCT ${leaveApprovals.leaveRequestId})`
          : sql<number>`count(*)`,
      })
      .from(leaveApprovals)
      .leftJoin(
        leaveRequests,
        eq(leaveApprovals.leaveRequestId, leaveRequests.id),
      )
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / filters.limit));

    // A request is waiting on the step it is currently parked at, so count
    // the requests whose current step is still undecided. Same predicate the
    // waitingOn filter uses, so a chip's count is what clicking it returns.
    const breakdownRows = await dbClient
      .select({
        stepKey: leaveRequests.currentStepKey,
        count: sql<number>`count(DISTINCT ${leaveApprovals.leaveRequestId})`,
      })
      .from(leaveApprovals)
      .leftJoin(
        leaveRequests,
        eq(leaveApprovals.leaveRequestId, leaveRequests.id),
      )
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(
        and(
          ...baseConditions,
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
          eq(leaveApprovals.stepKey, leaveRequests.currentStepKey),
        ),
      )
      .groupBy(leaveRequests.currentStepKey);

    const stepBreakdown = toStepBreakdown(breakdownRows);

    // The page window belongs on the thing the queue renders — one card per
    // request. Applying it to approval rows would put a request whose rows
    // straddle the boundary on both pages and drop another one entirely.
    let pageLeaveRequestIds: string[] = [];

    if (groupByLeaveRequest) {
      const pageIdRows = await dbClient
        .select({ leaveRequestId: leaveApprovals.leaveRequestId })
        .from(leaveApprovals)
        .leftJoin(
          leaveRequests,
          eq(leaveApprovals.leaveRequestId, leaveRequests.id),
        )
        .leftJoin(students, eq(leaveRequests.studentId, students.id))
        .leftJoin(users, eq(students.userId, users.id))
        .where(whereClause)
        .groupBy(leaveApprovals.leaveRequestId)
        // The id breaks ties: timestamps collide often enough that ordering on
        // them alone lets a request drift between pages as they are fetched.
        .orderBy(
          desc(sql`max(${leaveApprovals.createdAt})`),
          asc(leaveApprovals.leaveRequestId),
        )
        .limit(filters.limit)
        .offset(offset);

      pageLeaveRequestIds = pageIdRows.flatMap((row) =>
        row.leaveRequestId ? [row.leaveRequestId] : [],
      );

      if (pageLeaveRequestIds.length === 0) {
        return {
          items: [],
          total,
          page: filters.page,
          limit: filters.limit,
          totalPages,
          stepBreakdown,
        };
      }
    }

    const rowsQuery = dbClient
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
      .leftJoin(
        leaveRequests,
        eq(leaveApprovals.leaveRequestId, leaveRequests.id),
      )
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .leftJoin(
        leaveConfigurationContexts,
        eq(leaveRequests.id, leaveConfigurationContexts.leaveRequestId),
      )
      .leftJoin(
        leaveTypeVersions,
        eq(leaveConfigurationContexts.leaveTypeVersionId, leaveTypeVersions.id),
      )
      .leftJoin(
        workflowVersions,
        eq(leaveConfigurationContexts.workflowVersionId, workflowVersions.id),
      )
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(hostels, eq(users.hostelId, hostels.id))
      .leftJoin(academicGroups, eq(students.academicGroupId, academicGroups.id))
      .leftJoin(departments, eq(academicGroups.departmentId, departments.id))
      .where(
        groupByLeaveRequest
          ? and(
              whereClause,
              inArray(leaveApprovals.leaveRequestId, pageLeaveRequestIds),
            )
          : whereClause,
      )
      .orderBy(desc(leaveApprovals.createdAt));

    // Chain mode has no id window to page over, so it pages over rows.
    const rows = groupByLeaveRequest
      ? await rowsQuery
      : await rowsQuery.limit(filters.limit).offset(offset);

    const dedupedRows = groupByLeaveRequest
      ? pickCurrentStepRow(rows, pageLeaveRequestIds, (row) => ({
          entityId: row.leaveReqId,
          stepKey: row.approval.stepKey,
          stepOrder: row.stepOrder,
          currentStepKey: row.leaveReqCurrentStepKey,
        }))
      : rows;

    // Load the configured approval chain for each affected workflow so the UI
    // can render only the steps that actually exist for that leave type.
    const workflowIds = [
      ...new Set(
        dedupedRows
          .map((row) => row.leaveTypeDefaultWorkflowId)
          .filter((id): id is string => !!id),
      ),
    ];

    const stepsByWorkflow = await loadWorkflowSteps(workflowIds, dbClient);

    return {
      items: dedupedRows.map((row) => ({
        ...row.approval,
        approverRoleCode: row.roleCode,
        // Prefer the frozen steps from the leave's execution context (what
        // the chain actually was at submission time); fall back to the live
        // workflow for legacy leaves without a context.
        workflowSteps:
          (row.execWorkflowSteps as FrozenWorkflowStep[] | null) ??
          stepsByWorkflow.get(row.leaveTypeDefaultWorkflowId ?? "") ??
          [],
        leaveRequest: row.leaveReqId
          ? {
              id: row.leaveReqId,
              status: row.leaveReqStatus ?? "",
              startAt: row.leaveReqStartAt!,
              endAt: row.leaveReqEndAt!,
              reason: row.leaveReqReason ?? "",
              requestNumber: row.leaveReqNumber ?? "",
              submittedForm:
                (row.leaveReqSubmittedForm as Record<string, unknown> | null) ??
                null,
              currentStepKey: row.leaveReqCurrentStepKey ?? null,
              currentStepOrder: row.leaveReqCurrentStepOrder ?? null,
              policyResult:
                (row.leaveReqPolicyResult as Record<string, unknown> | null) ??
                null,
            }
          : null,
        studentName: row.studentName,
        studentRollNumber: row.studentRollNumber,
        roomNumber: row.roomNumber,
        hostelName: row.hostelName,
        departmentName: row.departmentName,
        leaveTypeName: row.execLeaveTypeName ?? row.leaveTypeName,
        leaveTypeUiConfig:
          ((row.execUiConfig ?? row.leaveTypeUiConfig) as Record<
            string,
            unknown
          > | null) ?? null,
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
      stepBreakdown,
    };
  },

  async findByEntityAndDecision(
    entityId: string,
    column:
      | typeof leaveApprovals.leaveRequestId
      | typeof leaveApprovals.leaveExtensionId,
    decision: LeaveApprovalDecision,
    dbClient: Pick<typeof db, "select"> = db,
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
      .leftJoin(roles, eq(leaveApprovals.approverRoleId, roles.id))
      .where(and(eq(column, entityId), eq(leaveApprovals.decision, decision)))
      .orderBy(leaveApprovals.stepOrder);

    return rows.map((row) => ({
      ...row.approval,
      approverRoleCode: row.roleCode,
    }));
  },

  async findNextByEntityAndDecision(
    entityId: string,
    column:
      | typeof leaveApprovals.leaveRequestId
      | typeof leaveApprovals.leaveExtensionId,
    currentStepOrder: number,
    decision: LeaveApprovalDecision,
    dbClient: Pick<typeof db, "select"> = db,
  ): Promise<LeaveApproval | null> {
    const rows = await dbClient
      .select()
      .from(leaveApprovals)
      .where(
        and(
          eq(column, entityId),
          gt(leaveApprovals.stepOrder, currentStepOrder),
          eq(leaveApprovals.decision, decision),
        ),
      )
      .orderBy(leaveApprovals.stepOrder)
      .limit(1);

    return rows[0] ?? null;
  },

  async updateDecisionByLeaveRequestId(
    leaveRequestId: string,
    decision: LeaveApprovalDecision,
    actedAt: Date,
    dbClient: Pick<typeof db, "update"> = db,
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
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
        ),
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
          eq(leaveApprovals.id, id),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
        ),
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
    dbClient: Pick<typeof db, "select"> = db,
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
    stats: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
    };
    stepBreakdown: ApprovalStepBreakdownEntry[];
  }> {
    const offset = (filters.page - 1) * filters.limit;

    const scopeConditions: ReturnType<typeof and>[] = [
      isNotNull(leaveApprovals.leaveExtensionId),
    ];

    if (filters.hostelId) {
      scopeConditions.push(eq(users.hostelId, filters.hostelId));
    }
    if (filters.hostelIds?.length) {
      scopeConditions.push(inArray(users.hostelId, filters.hostelIds));
    }

    // Everything except the waiting-on filter. The step breakdown has to be
    // counted over this set: counting it over the filtered rows would make
    // the chips describe their own output.
    const baseConditions = [...scopeConditions];

    if (filters.status) {
      baseConditions.push(eq(leaveExtensions.status, filters.status));
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      baseConditions.push(
        or(
          like(leaveRequests.requestNumber, searchPattern),
          like(users.fullName, searchPattern),
        ),
      );
    }
    if (filters.leaveTypeId) {
      baseConditions.push(eq(leaveRequests.leaveTypeId, filters.leaveTypeId));
    }
    if (filters.dateFrom) {
      baseConditions.push(gte(leaveApprovals.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      baseConditions.push(lte(leaveApprovals.createdAt, filters.dateTo));
    }

    const whereClause = filters.waitingOn
      ? and(
          ...baseConditions,
          eq(leaveExtensions.currentStepKey, filters.waitingOn),
        )
      : and(...baseConditions);
    const scopeWhereClause = and(...scopeConditions);

    const countResult = await dbClient
      .select({
        count: sql<number>`count(DISTINCT ${leaveApprovals.leaveExtensionId})`,
      })
      .from(leaveApprovals)
      .innerJoin(
        leaveExtensions,
        eq(leaveApprovals.leaveExtensionId, leaveExtensions.id),
      )
      .leftJoin(
        leaveRequests,
        eq(leaveExtensions.leaveRequestId, leaveRequests.id),
      )
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / filters.limit));

    // Stats are distinct-extension counts by extension status, scoped only.
    const statsRows = await dbClient
      .select({
        status: leaveExtensions.status,
        count: sql<number>`count(DISTINCT ${leaveApprovals.leaveExtensionId})`,
      })
      .from(leaveApprovals)
      .innerJoin(
        leaveExtensions,
        eq(leaveApprovals.leaveExtensionId, leaveExtensions.id),
      )
      .leftJoin(
        leaveRequests,
        eq(leaveExtensions.leaveRequestId, leaveRequests.id),
      )
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(scopeWhereClause)
      .groupBy(leaveExtensions.status);

    const countsByStatus = new Map(
      statsRows.map((row) => [row.status, Number(row.count ?? 0)]),
    );
    const statsTotal = [...countsByStatus.values()].reduce(
      (sum, c) => sum + c,
      0,
    );
    const stats = {
      total: statsTotal,
      pending: countsByStatus.get(LEAVE_REQUEST_STATUS.PENDING) ?? 0,
      approved: countsByStatus.get(LEAVE_REQUEST_STATUS.APPROVED) ?? 0,
      rejected: countsByStatus.get(LEAVE_REQUEST_STATUS.REJECTED) ?? 0,
    };

    // An extension is waiting on the step it is currently parked at, so count
    // the extensions whose current step is still undecided. Same predicate the
    // waitingOn filter uses, so a chip's count is what clicking it returns.
    const breakdownRows = await dbClient
      .select({
        stepKey: leaveExtensions.currentStepKey,
        count: sql<number>`count(DISTINCT ${leaveApprovals.leaveExtensionId})`,
      })
      .from(leaveApprovals)
      .innerJoin(
        leaveExtensions,
        eq(leaveApprovals.leaveExtensionId, leaveExtensions.id),
      )
      .leftJoin(
        leaveRequests,
        eq(leaveExtensions.leaveRequestId, leaveRequests.id),
      )
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(
        and(
          ...baseConditions,
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
          eq(leaveApprovals.stepKey, leaveExtensions.currentStepKey),
        ),
      )
      .groupBy(leaveExtensions.currentStepKey);

    const stepBreakdown = toStepBreakdown(breakdownRows);

    // The page window belongs on the thing the queue renders — one card per
    // extension. Applying it to approval rows would put an extension whose
    // rows straddle the boundary on both pages and drop another one entirely.
    const pageIdRows = await dbClient
      .select({ leaveExtensionId: leaveApprovals.leaveExtensionId })
      .from(leaveApprovals)
      .innerJoin(
        leaveExtensions,
        eq(leaveApprovals.leaveExtensionId, leaveExtensions.id),
      )
      .leftJoin(
        leaveRequests,
        eq(leaveExtensions.leaveRequestId, leaveRequests.id),
      )
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(whereClause)
      .groupBy(leaveApprovals.leaveExtensionId)
      // The id breaks ties: timestamps collide often enough that ordering on
      // them alone lets an extension drift between pages as they are fetched.
      .orderBy(
        desc(sql`max(${leaveApprovals.createdAt})`),
        asc(leaveApprovals.leaveExtensionId),
      )
      .limit(filters.limit)
      .offset(offset);

    const pageExtensionIds = pageIdRows.flatMap((row) =>
      row.leaveExtensionId ? [row.leaveExtensionId] : [],
    );

    if (pageExtensionIds.length === 0) {
      return {
        items: [],
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages,
        stats,
        stepBreakdown,
      };
    }

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
      .innerJoin(
        leaveExtensions,
        eq(leaveApprovals.leaveExtensionId, leaveExtensions.id),
      )
      .leftJoin(
        leaveRequests,
        eq(leaveExtensions.leaveRequestId, leaveRequests.id),
      )
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .leftJoin(
        leaveConfigurationContexts,
        eq(leaveRequests.id, leaveConfigurationContexts.leaveRequestId),
      )
      .leftJoin(
        leaveTypeVersions,
        eq(leaveConfigurationContexts.leaveTypeVersionId, leaveTypeVersions.id),
      )
      .leftJoin(
        workflowVersions,
        eq(leaveConfigurationContexts.workflowVersionId, workflowVersions.id),
      )
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(hostels, eq(users.hostelId, hostels.id))
      .leftJoin(academicGroups, eq(students.academicGroupId, academicGroups.id))
      .leftJoin(departments, eq(academicGroups.departmentId, departments.id))
      .leftJoin(parents, eq(leaveApprovals.approverParentId, parents.id))
      .where(
        and(
          whereClause,
          inArray(leaveApprovals.leaveExtensionId, pageExtensionIds),
        ),
      )
      .orderBy(desc(leaveApprovals.createdAt));

    const dedupedRows = pickCurrentStepRow(rows, pageExtensionIds, (row) => ({
      entityId: row.extId,
      stepKey: row.approval.stepKey,
      stepOrder: row.approval.stepOrder,
      currentStepKey: row.extCurrentStepKey,
    }));

    // Load the configured approval chain for each affected workflow so the UI
    // can render only the steps that actually exist for that leave type.
    const workflowIds = [
      ...new Set(
        dedupedRows
          .map((row) => row.leaveTypeDefaultWorkflowId)
          .filter((id): id is string => !!id),
      ),
    ];

    const stepsByWorkflow = await loadWorkflowSteps(workflowIds, dbClient);

    return {
      items: dedupedRows.map((row) => ({
        ...row.approval,
        approverRoleCode: row.roleCode,
        // Frozen steps from the parent leave's execution context; fall back
        // to the live workflow for legacy leaves without a context.
        workflowSteps:
          (row.execWorkflowSteps as FrozenWorkflowStep[] | null) ??
          stepsByWorkflow.get(row.leaveTypeDefaultWorkflowId ?? "") ??
          [],
        leaveTypeName: row.execLeaveTypeName ?? row.leaveTypeName,
        leaveTypeUiConfig:
          ((row.execUiConfig ?? row.leaveTypeUiConfig) as Record<
            string,
            unknown
          > | null) ?? null,
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
      stepBreakdown,
    };
  },

  // parent methods moved to leave-parent-approval.repository

  async findById(
    id: string,
    dbClient: Pick<typeof db, "select"> = db,
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
    dbClient: Pick<typeof db, "select"> = db,
  ): Promise<LeaveApproval[]> {
    return await dbClient
      .select()
      .from(leaveApprovals)
      .where(eq(leaveApprovals.leaveRequestId, leaveRequestId))
      .orderBy(leaveApprovals.stepOrder);
  },
};

export default leaveApprovalRepository;
