import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision"
import { leaveRepository } from "@/db/repositories/leave/leave.repository"
import { leaveParentApprovalRepository } from "@/db/repositories/leave/leave-parent-approval.repository"
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository"
import { parentRepository } from "@/db/repositories/parent/parent.repository"
import { sha256 } from "@/lib/crypto"
import { ConflictError, NotFoundError } from "@/lib/errors"

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

  if (!approval) {
    throw new NotFoundError("Approval")
  }

  if (
    approval.parentApprovalExpiresAt &&
    new Date(approval.parentApprovalExpiresAt) < new Date()
  ) {
    throw new ConflictError("Approval link has expired")
  }

  if (approval.decision !== LEAVE_APPROVAL_DECISION.PENDING) {
    throw new ConflictError("Approval already processed")
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
