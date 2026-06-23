import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { sha256 } from "@/lib/crypto";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export type VerifyOtpResult = {
  approvalId: string;
  targetType: "LEAVE_REQUEST" | "LEAVE_EXTENSION";
  leaveRequestId: string;
  leaveExtensionId: string | null;
  extensionNumber: number | null;
  studentName: string;
  studentRollNumber: string;
  leaveReason: string;
  leaveStartDate: Date;
  leaveEndDate: Date;
  submittedForm: Record<string, unknown> | null;
};

export async function verifyParentOtp(
  rawToken: string,
  otp: string
): Promise<VerifyOtpResult> {
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

  if (!approval.parentApprovalOtpHash) {
    throw new ValidationError("OTP not sent yet");
  }

  if (
    approval.parentApprovalExpiresAt &&
    new Date(approval.parentApprovalExpiresAt) < new Date()
  ) {
    throw new ConflictError("OTP has expired");
  }

  const otpHash = await sha256(otp);

  if (otpHash !== approval.parentApprovalOtpHash) {
    throw new ValidationError("Invalid OTP");
  }

  await leaveApprovalRepository.updateParentApprovalVerified(
    approval.id
  );

  await auditService.record(
    AUDIT_ACTION.UPDATE,
    AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
    approval.id,
    null,
    {
      leaveRequestId: approval.leaveRequestId,
      leaveExtensionId: approval.leaveExtensionId,
      action: "PARENT_OTP_VERIFIED",
    }
  );

  // Determine target type and resolve details
  const isExtension = !!approval.leaveExtensionId;
  const leaveRequestId = isExtension
    ? approval.leaveExtension?.leaveRequestId ?? approval.leaveRequestId ?? ""
    : approval.leaveRequestId ?? "";

  if (!leaveRequestId) {
    throw new NotFoundError("LeaveRequest");
  }

  if (isExtension) {
    const ext = approval.leaveExtension;
    if (!ext) {
      throw new NotFoundError("LeaveExtension");
    }

    return {
      approvalId: approval.id,
      targetType: "LEAVE_EXTENSION",
      leaveRequestId,
      leaveExtensionId: approval.leaveExtensionId!,
      extensionNumber: ext.extensionNumber,
      studentName: approval.studentName ?? "",
      studentRollNumber: approval.studentRollNumber ?? "",
      leaveReason: ext.reason,
      leaveStartDate: ext.currentEndAt,
      leaveEndDate: ext.requestedEndAt,
      submittedForm: ext.submittedForm,
    };
  }

  const lr = approval.leaveRequest;
  if (!lr) {
    throw new NotFoundError("LeaveRequest");
  }    return {
      approvalId: approval.id,
      targetType: "LEAVE_REQUEST",
      leaveRequestId,
      leaveExtensionId: null,
      extensionNumber: null,
      studentName: approval.studentName ?? "",
      studentRollNumber: approval.studentRollNumber ?? "",
      leaveReason: lr.reason,
      leaveStartDate: lr.startAt,
      leaveEndDate: lr.endAt,
      submittedForm: lr.submittedForm,
    };
}
