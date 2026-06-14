import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { OTP_EXPIRY_MINUTES } from "@/constants/parent/parent-approval";
import { parentRepository } from "@/db/repositories/hostel/parent.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { transaction } from "@/lib/db/transaction";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type SendOtpResult = {
  phoneLast4: string;
};

export async function sendParentOtp(
  rawToken: string,
  phone: string
): Promise<SendOtpResult> {
  const tokenHash = await sha256(rawToken);

  const approval =
    await leaveApprovalRepository.findByParentApprovalToken(
      tokenHash
    );

  if (!approval) {
    throw new NotFoundError("Approval");
  }

  if (
    approval.parentApprovalExpiresAt &&
    new Date(approval.parentApprovalExpiresAt) < new Date()
  ) {
    throw new ConflictError("Approval link has expired");
  }

  if (approval.parentApprovalVerifiedAt) {
    throw new ConflictError("Approval already verified");
  }

  if (approval.decision !== LEAVE_APPROVAL_DECISION.PENDING) {
    throw new ConflictError("Approval already processed");
  }

  const parent = await parentRepository.findById(
    approval.approverParentId ?? ""
  );

  if (!parent) {
    throw new NotFoundError("Parent");
  }

  if (parent.phone !== phone) {
    throw new ValidationError(
      "Phone number does not match parent's registered phone"
    );
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await sha256(otp);

  const otpExpiresAt = new Date();
  otpExpiresAt.setMinutes(
    otpExpiresAt.getMinutes() + OTP_EXPIRY_MINUTES
  );

  await leaveApprovalRepository.updateParentApprovalOtp(
    approval.id,
    otpHash,
    otpExpiresAt
  );

  await transaction(async (tx) => {
    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
      approval.id,
      parent.id,
      {
        leaveRequestId: approval.leaveRequestId,
        action: "PARENT_OTP_SENT",
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.NOTIFICATION_REQUESTED,
      aggregateType: AGGREGATE_TYPE.NOTIFICATION,
      aggregateId: approval.id,
      payload: {
        notificationType: "PARENT_APPROVAL_REQUESTED",
        leaveRequestId: approval.leaveRequestId ?? undefined,
        parentId: parent.id,
        recipientPhone: parent.phone,
        variables: {
          otp,
          studentName: approval.studentName ?? "",
        },
      },
    }, tx);
  });

  return {
    phoneLast4: phone.slice(-4),
  };
}

