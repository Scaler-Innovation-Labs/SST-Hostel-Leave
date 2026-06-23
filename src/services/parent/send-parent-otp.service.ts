import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { NOTIFICATION_CHANNEL } from "@/constants/notification/notification-channel";
import { NOTIFICATION_DELIVERY_STATUS } from "@/constants/notification/notification-delivery-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { OTP_EXPIRY_MINUTES } from "@/constants/parent/parent-approval";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { notificationLogRepository } from "@/db/repositories/notification/notification-log.repository";
import { parentRepository } from "@/db/repositories/parent/parent.repository";
import { sha256 } from "@/lib/crypto";
import { transaction } from "@/lib/db/transaction";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { createSmsProvider } from "@/services/notification/providers/sms.provider";
import { outboxService } from "@/services/outbox/outbox.service";

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

  // Determine target type and build context
  const isExtension = !!approval.leaveExtensionId;
  const leaveRequestId = isExtension
    ? approval.leaveExtension?.leaveRequestId ?? approval.leaveRequestId ?? ""
    : approval.leaveRequestId ?? "";

  if (!leaveRequestId) {
    throw new NotFoundError("LeaveRequest");
  }

  // Build date descriptions
  let dates = "";
  let reason = "";
  let smsBody = "";

  if (isExtension) {
    const ext = approval.leaveExtension;
    if (ext) {
      dates = `${ext.currentEndAt.toLocaleDateString()} → ${ext.requestedEndAt.toLocaleDateString()}`;
      reason = ext.reason;
    }
    smsBody = `${approval.studentName ?? "Student"} requested a leave extension. `;
  } else {
    const leave = await leaveRepository.findById(leaveRequestId);
    if (leave) {
      dates = `${leave.startAt.toLocaleDateString()} - ${leave.endAt.toLocaleDateString()}`;
      reason = leave.reason;
    }
    smsBody = `${approval.studentName ?? "Student"} applied for a leave. `;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const approvalLink = `${baseUrl}/parent-approve/${rawToken}`;
  const shortCode = approval.id.replace(/-/g, "").slice(-8).toLowerCase();

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
      null,
      {
        leaveRequestId: approval.leaveRequestId,
        leaveExtensionId: approval.leaveExtensionId,
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
        leaveExtensionId: approval.leaveExtensionId ?? undefined,
        parentId: parent.id,
        recipientPhone: parent.phone,
        variables: {
          studentName: approval.studentName ?? "",
          dates,
          reason,
          approvalLink,
          code: shortCode,
        },
      },
    }, tx);
  });

  smsBody += `OTP: ${otp}. Approve: ${approvalLink} or reply 1 ${shortCode} to approve, 2 ${shortCode} to reject.`;
  const smsProvider = createSmsProvider();
  const otpResult = await smsProvider.send({ to: parent.phone, body: smsBody });

  await notificationLogRepository.create({
    leaveRequestId: approval.leaveRequestId ?? null,
    leaveExtensionId: approval.leaveExtensionId ?? null,
    userId: null,
    parentId: parent.id,
    channel: NOTIFICATION_CHANNEL.SMS,
    eventType: "PARENT_APPROVAL_REQUESTED",
    recipient: parent.phone,
    deliveryStatus: otpResult.success
      ? NOTIFICATION_DELIVERY_STATUS.SENT
      : NOTIFICATION_DELIVERY_STATUS.FAILED,
    providerResponse: otpResult.error ?? null,
    providerMessageId: otpResult.messageId ?? null,
    sentAt: otpResult.success ? new Date() : null,
    metadata: { studentName: approval.studentName ?? "" },
  });

  return {
    phoneLast4: phone.slice(-4),
  };
}
