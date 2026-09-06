import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision"
import { leaveRepository } from "@/db/repositories/leave/leave.repository"
import { leaveParentApprovalRepository } from "@/db/repositories/leave/leave-parent-approval.repository"
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository"
import { parentRepository } from "@/db/repositories/parent/parent.repository"
import { sha256 } from "@/lib/crypto"
import { NotFoundError, ValidationError } from "@/lib/errors"
import { logger } from "@/lib/logger"

export type LeaveDetailsResult = {
  approvalId: string
  targetType: "LEAVE_REQUEST" | "LEAVE_EXTENSION"
  leaveRequestId: string
  leaveExtensionId: string | null
  extensionNumber: number | null
  studentName: string
  studentRollNumber: string
  leaveTypeName: string
  leaveTypeDescription: string
  leaveReason: string
  leaveStartDate: string
  leaveEndDate: string
  submittedForm: Record<string, unknown> | null
  parentName: string
  parentPhone: string
}

async function resolveLeaveType(
  leaveTypeId?: string | null
): Promise<{ leaveTypeName: string; leaveTypeDescription: string }> {
  if (!leaveTypeId) {
    return { leaveTypeName: "", leaveTypeDescription: "" }
  }
  const leaveType = await leaveTypeRepository.findById(leaveTypeId)
  return {
    leaveTypeName: leaveType?.name ?? "",
    leaveTypeDescription: leaveType?.description ?? "",
  }
}

export async function getLeaveDetailsByToken(
  rawToken: string
): Promise<LeaveDetailsResult> {
  const tokenHash = await sha256(rawToken)
  const approval =
    await leaveParentApprovalRepository.findByParentApprovalToken(tokenHash)

  // Oracle hardening: invalid / expired / already-responded links all
  // surface the SAME generic message. The real state is logged server-side
  // (approval id only — never the raw token) for support triage.
  // ValidationError carries the message verbatim (NotFoundError would append
  // "not found"), keeping all three states byte-identical to the caller.
  if (!approval) {
    logger.warn("Parent approval link lookup failed: unknown token hash", {})
    throw new ValidationError("Unable to process this approval link")
  }

  if (
    approval.parentApprovalExpiresAt &&
    new Date(approval.parentApprovalExpiresAt) < new Date()
  ) {
    logger.warn("Parent approval link lookup failed: link expired", {
      approvalId: approval.id,
    })
    throw new ValidationError("Unable to process this approval link")
  }

  if (approval.decision !== LEAVE_APPROVAL_DECISION.PENDING) {
    logger.warn("Parent approval link lookup failed: already processed", {
      approvalId: approval.id,
    })
    throw new ValidationError("Unable to process this approval link")
  }

  const parentId = approval.approverParentId
  let parentName = ""
  let parentPhone = ""
  if (parentId) {
    const parent = await parentRepository.findById(parentId)
    if (parent) {
      parentName = parent.name
      parentPhone = parent.phone
    }
  }

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

    // The extension itself does not carry a leave type; resolve it through
    // the parent leave request it extends.
    const parentLeave = ext.leaveRequestId
      ? await leaveRepository.findById(ext.leaveRequestId)
      : null
    const { leaveTypeName, leaveTypeDescription } = await resolveLeaveType(
      parentLeave?.leaveTypeId
    )

    return {
      approvalId: approval.id,
      targetType: "LEAVE_EXTENSION",
      leaveRequestId,
      leaveExtensionId: approval.leaveExtensionId!,
      extensionNumber: ext.extensionNumber,
      studentName: approval.studentName ?? "",
      studentRollNumber: approval.studentRollNumber ?? "",
      leaveTypeName,
      leaveTypeDescription,
      leaveReason: ext.reason,
      leaveStartDate: ext.currentEndAt.toISOString(),
      leaveEndDate: ext.requestedEndAt.toISOString(),
      submittedForm: ext.submittedForm,
      parentName,
      parentPhone,
    }
  }

  const lr = approval.leaveRequest
  if (!lr) {
    throw new NotFoundError("LeaveRequest")
  }

  const parentLeave = await leaveRepository.findById(leaveRequestId)
  const { leaveTypeName, leaveTypeDescription } = await resolveLeaveType(
    parentLeave?.leaveTypeId
  )

  return {
    approvalId: approval.id,
    targetType: "LEAVE_REQUEST",
    leaveRequestId,
    leaveExtensionId: null,
    extensionNumber: null,
    studentName: approval.studentName ?? "",
    studentRollNumber: approval.studentRollNumber ?? "",
    leaveTypeName,
    leaveTypeDescription,
    leaveReason: lr.reason,
    leaveStartDate: lr.startAt.toISOString(),
    leaveEndDate: lr.endAt.toISOString(),
    submittedForm: lr.submittedForm,
    parentName,
    parentPhone,
  }
}
