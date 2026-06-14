import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type VerifyOtpResult = {
  approvalId: string;
  leaveRequestId: string;
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
    approval.approverParentId ?? "",
    {
      leaveRequestId: approval.leaveRequestId,
      action: "PARENT_OTP_VERIFIED",
    }
  );

  if (!approval.leaveRequest) {
    throw new NotFoundError("LeaveRequest");
  }

  return {
    approvalId: approval.id,
    leaveRequestId: approval.leaveRequest.id,
    studentName: approval.studentName ?? "",
    studentRollNumber: approval.studentRollNumber ?? "",
    leaveReason: approval.leaveRequest.reason,
    leaveStartDate: approval.leaveRequest.startAt,
    leaveEndDate: approval.leaveRequest.endAt,
    submittedForm: approval.leaveRequest.submittedForm,
  };
}

