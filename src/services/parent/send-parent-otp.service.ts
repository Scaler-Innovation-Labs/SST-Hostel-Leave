import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision"
import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event"
import { OTP_EXPIRY_MINUTES } from "@/constants/parent/parent-approval"
import { leaveRepository } from "@/db/repositories/leave/leave.repository"
import { leaveParentApprovalRepository } from "@/db/repositories/leave/leave-parent-approval.repository"
import { parentRepository } from "@/db/repositories/parent/parent.repository"
import { parentOtpSessionRepository } from "@/db/repositories/parent/parent-otp-session.repository"
import { sha256 } from "@/lib/crypto"
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors"
import { sendApprovalOtpViaMsg91,sendOtpViaMsg91 } from "@/lib/messaging/otp/msg91-otp"
import { notificationService } from "@/services/notification/notification.service"

export type SendOtpResult = {
  phoneLast4: string
}

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function isMsg91OtpConfigured(): boolean {
  return !!process.env.MSG91_OTP_TEMPLATE_ID
}

function isMsg91ApprovalOtpConfigured(): boolean {
  return !!process.env.MSG91_OTP_APPROVAL_TEMPLATE_ID
}

function formatPhone(phone: string): string {
  return phone.slice(-4)
}

export async function sendParentOtp(
  rawToken: string,
  phone: string
): Promise<SendOtpResult> {
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

  const parent = await parentRepository.findById(
    approval.approverParentId ?? ""
  )

  if (!parent) {
    throw new NotFoundError("Parent")
  }

  if (parent.phone !== phone) {
    throw new ValidationError(
      "Phone number does not match parent's registered phone"
    )
  }

  const isExtension = !!approval.leaveExtensionId
  const leaveRequestId = isExtension
    ? (approval.leaveExtension?.leaveRequestId ?? approval.leaveRequestId ?? "")
    : (approval.leaveRequestId ?? "")

  if (!leaveRequestId) {
    throw new NotFoundError("LeaveRequest")
  }

  let dates = ""
  let reason = ""

  if (isExtension) {
    const ext = approval.leaveExtension
    if (ext) {
      dates = `${ext.currentEndAt.toLocaleDateString()} → ${ext.requestedEndAt.toLocaleDateString()}`
      reason = ext.reason
    }
  } else {
    const leave = await leaveRepository.findById(leaveRequestId)
    if (leave) {
      dates = `${leave.startAt.toLocaleDateString()} - ${leave.endAt.toLocaleDateString()}`
      reason = leave.reason
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
  const approvalLink = `${baseUrl}/parent-approve/${rawToken}`
  const shortCode = approval.id.replace(/-/g, "").slice(-8).toLowerCase()

  const otpCode = generateOtpCode()
  const otpHash = await sha256(otpCode)
  const studentName = approval.studentName ?? "Student"

  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES)

  await parentOtpSessionRepository.create({
    parentId: parent.id,
    phone,
    otpHash,
    expiresAt,
  })

  if (isMsg91ApprovalOtpConfigured()) {
    await sendApprovalOtpViaMsg91(phone, otpCode, {
      studentName,
      dates,
      reason,
      approvalLink,
      shortCode,
    })
    return { phoneLast4: formatPhone(phone) }
  } else if (isMsg91OtpConfigured()) {
    await Promise.all([
      sendOtpViaMsg91(phone, otpCode),
      notificationService.sendSms(phone, `${studentName} applied for a leave. Dates: ${dates}. Reason: ${reason}. Approve: ${approvalLink} or reply 1 ${shortCode} to approve, 2 ${shortCode} to reject.`, {
        eventType: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
        leaveRequestId: approval.leaveRequestId ?? undefined,
        leaveExtensionId: approval.leaveExtensionId ?? undefined,
        parentId: parent.id,
        metadata: { studentName, otpReqId: "" },
      }),
    ])
  } else {
    const smsBody = `${studentName} applied for a leave. Dates: ${dates}. Reason: ${reason}. Approve: ${approvalLink} or reply 1 ${shortCode} to approve, 2 ${shortCode} to reject.\nOTP: ${otpCode}`

    await notificationService.sendSms(phone, smsBody, {
      eventType: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      leaveRequestId: approval.leaveRequestId ?? undefined,
      leaveExtensionId: approval.leaveExtensionId ?? undefined,
      parentId: parent.id,
      metadata: { studentName, otpReqId: "" },
    })
  }

  return {
    phoneLast4: phone.slice(-4),
  }
}
