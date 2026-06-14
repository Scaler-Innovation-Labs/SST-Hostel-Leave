import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { PARENT_APPROVAL_TOKEN_EXPIRY_HOURS } from "@/constants/parent/parent-approval";
import { parentRepository } from "@/db/repositories/hostel/parent.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return toHex(new Uint8Array(hashBuffer));
}

export type GenerateParentApprovalContext = {
  leaveRequestId: string;
  studentId: string;
  studentName: string;
  leaveDates: string;
  leaveReason: string;
  baseUrl: string;
};

export async function generateParentApproval(
  context: GenerateParentApprovalContext,
  approvalStep: {
    id: string;
    stepKey: string;
  }
): Promise<void> {
  const parent = await parentRepository.findPrimaryByStudentId(
    context.studentId
  );

  if (!parent) {
    throw new NotFoundError("Parent");
  }

  if (!parent.phone) {
    throw new ValidationError("Parent has no phone number");
  }

  const rawBytes = new Uint8Array(32);
  crypto.getRandomValues(rawBytes);
  const rawToken = toHex(rawBytes);
  const tokenHash = await sha256(rawToken);

  const expiresAt = new Date();
  expiresAt.setHours(
    expiresAt.getHours() + PARENT_APPROVAL_TOKEN_EXPIRY_HOURS
  );

  await transaction(async (tx) => {
    await leaveApprovalRepository.updateParentApprovalOtp(
      approvalStep.id,
      tokenHash,
      expiresAt,
      tx
    );

    const approvalLink = `${context.baseUrl}/parent-approve/${rawToken}`;

    await auditService.record(
      AUDIT_ACTION.CREATE,
      AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
      approvalStep.id,
      parent.id,
      {
        leaveRequestId: context.leaveRequestId,
        action: "PARENT_APPROVAL_TOKEN_GENERATED",
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.NOTIFICATION_REQUESTED,
      aggregateType: AGGREGATE_TYPE.NOTIFICATION,
      aggregateId: approvalStep.id,
      payload: {
        notificationType: "PARENT_APPROVAL_REQUESTED",
        leaveRequestId: context.leaveRequestId,
        parentId: parent.id,
        recipientPhone: parent.phone,
        variables: {
          studentName: context.studentName,
          dates: context.leaveDates,
          reason: context.leaveReason,
          approvalLink,
        },
      },
    }, tx);
  });
}

