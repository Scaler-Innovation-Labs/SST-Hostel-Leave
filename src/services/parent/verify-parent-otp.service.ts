import { AUDIT_ACTION } from "@/constants/audit/audit-action"
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type"
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision"
import { leaveParentApprovalRepository } from "@/db/repositories/leave/leave-parent-approval.repository"
import { parentRepository } from "@/db/repositories/parent/parent.repository"
import { parentOtpSessionRepository } from "@/db/repositories/parent/parent-otp-session.repository"
import { sha256 } from "@/lib/crypto"
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors"
import { verifyOtpViaMsg91 } from "@/lib/messaging/otp/msg91-otp"
import { auditService } from "@/services/audit/audit.service"

function isMsg91OtpConfigured(): boolean {
  return !!process.env.MSG91_OTP_TEMPLATE_ID
}

export type VerifyOtpResult = {
  approvalId: string
  targetType: "LEAVE_REQUEST" | "LEAVE_EXTENSION"
  leaveRequestId: string
  leaveExtensionId: string | null
  extensionNumber: number | null
  studentName: string
  studentRollNumber: string
  leaveReason: string
  leaveStartDate: Date
  leaveEndDate: Date
  submittedForm: Record<string, unknown> | null
}

export async function verifyParentOtp(
  rawToken: string,
  otp: string
): Promise<VerifyOtpResult> {
  const tokenHash = await sha256(rawToken)
  const approval =
    await leaveParentApprovalRepository.findByParentApprovalToken(tokenHash)

  if (!approval) {
    throw new NotFoundError("Approval")
  }

  if (
    approval.parentApprovalExpiresAt &&
    new Date(approval.parentApprovalExpiresAt) < new Date()
  ) {
    throw new ConflictError("Approval link has expired")
  }

  if (approval.parentApprovalVerifiedAt) {
    throw new ConflictError("Approval already verified")
  }

  if (approval.decision !== LEAVE_APPROVAL_DECISION.PENDING) {
    throw new ConflictError("Approval already processed")
  }

  const parentId = approval.approverParentId
  if (!parentId) {
    throw new NotFoundError("Parent")
  }

  const parent = await parentRepository.findById(parentId)
  if (!parent) {
    throw new NotFoundError("Parent")
  }

  const session = await parentOtpSessionRepository.findValidByPhone(parent.phone)
  if (!session) {
    throw new ValidationError("OTP session expired or not found")
  }

  const valid = isMsg91OtpConfigured()
    ? await verifyOtpViaMsg91(parent.phone, otp)
    : (await sha256(otp)) === session.otpHash

  if (!valid) {
    throw new ValidationError("Invalid OTP")
  }

  await parentOtpSessionRepository.markVerified(session.id)
  await leaveParentApprovalRepository.updateParentApprovalVerified(approval.id)

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
  )

  const isExtension = !!approval.leaveExtensionId
  const leaveRequestId = isExtension
    ? (approval.leaveExtension?.leaveRequestId ?? approval.leaveRequestId ?? "")
    : (approval.leaveRequestId ?? "")

  if (!leaveRequestId) {
    throw new NotFoundError("LeaveRequest")
  }

  if (isExtension) {
    const ext = approval.leaveExtension
    if (!ext) {
      throw new NotFoundError("LeaveExtension")
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
    }
  }

  const lr = approval.leaveRequest
  if (!lr) {
    throw new NotFoundError("LeaveRequest")
  }

  return {
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
  }
}
