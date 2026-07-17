import type { AuditAction } from "@/constants/audit/audit-action";
import type { AuditEntityType } from "@/constants/audit/audit-entity-type";
import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { type leaveApprovals } from "@/db";
import type { LeaveApproval } from "@/db/repositories/leave/leave-approval.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { requireAnyRole, requireApprovalAuthorization } from "@/lib/auth/authorization";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import type { DbClient } from "@/lib/db/transaction";
import { ConflictError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export function checkParentOverride(
  current: { approverParentId: string | null; approverUserId: string | null; approverRoleCode: string | null; stepKey: string; stepOrder: number | null },
  dto: { forceOverride?: boolean },
  currentUser: { id: string; roles: string[] }
): { isParentOverride: boolean; requiresConfirmation?: boolean; warning?: string; decision?: string; stepKey?: string; stepOrder?: number | null; newStatus?: null } | null {
  const isParentApprovalStep = !!(current.approverParentId && !current.approverUserId);

  if (isParentApprovalStep) {
    requireAnyRole(currentUser as CurrentUser, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    if (!dto.forceOverride) {
      return {
        isParentOverride: true,
        decision: LEAVE_APPROVAL_DECISION.PENDING,
        stepKey: current.stepKey,
        stepOrder: current.stepOrder,
        newStatus: null,
        warning: "Parent approval is still pending. Approving will override the parent approval process.",
        requiresConfirmation: true,
      };
    }
  } else {
    requireApprovalAuthorization(current, currentUser);
  }

  return { isParentOverride: false };
}

export async function updateApprovalAndAudit(
  current: { id: string },
  decision: LeaveApprovalDecision,
  userId: string,
  comments: string | undefined,
  auditAction: AuditAction,
  auditEntityType: AuditEntityType,
  auditMeta: Record<string, unknown>,
  tx: DbClient
): Promise<void> {
  const updated = await leaveApprovalRepository.updateDecisionById(
    current.id,
    decision,
    userId,
    comments,
    new Date(),
    tx
  );

  if (!updated) {
    throw new ConflictError("Approval already processed");
  }

  await auditService.record(
    auditAction,
    auditEntityType,
    current.id,
    userId,
    auditMeta,
    tx
  );
}

export async function handleNextStep<T>(
  entityId: string,
  column: typeof leaveApprovals.leaveRequestId | typeof leaveApprovals.leaveExtensionId,
  currentStepOrder: number | null,
  updateCurrentStep: (entityId: string, stepKey: string, stepOrder: number, tx: DbClient) => Promise<{ id: string } | null>,
  buildResult: (next: LeaveApproval) => T,
  tx: DbClient
): Promise<T | null> {
  const next = await leaveApprovalRepository.findNextByEntityAndDecision(
    entityId,
    column,
    currentStepOrder ?? 0,
    LEAVE_APPROVAL_DECISION.PENDING,
    tx
  );

  if (!next) return null;

  await updateCurrentStep(entityId, next.stepKey, next.stepOrder, tx);

  return buildResult(next);
}

export function getApprovalAuditMeta(
  entityId: string,
  comments: string | undefined,
  isParentOverride: boolean
): Record<string, unknown> {
  return {
    leaveRequestId: entityId,
    comments,
    ...(isParentOverride ? { overrideType: "PARENT_OVERRIDE" } : {}),
  };
}
