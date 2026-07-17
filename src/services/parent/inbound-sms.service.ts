import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source"
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision"
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status"
import { MOVEMENT_EVENT } from "@/constants/movement/movement-event"
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method"
import { MOVEMENT_STATE } from "@/constants/movement/movement-state"
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types"
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types"
import { leaveApprovals } from "@/db"
import { leaveRepository } from "@/db/repositories/leave/leave.repository"
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository"
import { parentRepository } from "@/db/repositories/parent/parent.repository"
import { transaction } from "@/lib/db/transaction"
import { parseSmsAction } from "@/lib/messaging/sms/webhook"
import { auditService } from "@/services/audit/audit.service"
import { recordMovement } from "@/services/movement/record-movement.service"
import { outboxService } from "@/services/outbox/outbox.service"

export type InboundSmsResult = {
  message: string
}

export async function handleIncomingSms(from: string, body: string): Promise<InboundSmsResult> {
  const parsed = parseSmsAction(body)
  if (!parsed) {
    return { message: "Reply 1 <code> to approve or 2 <code> to reject." }
  }

  const parents = await parentRepository.findAllByPhone(from)
  if (parents.length === 0) {
    return { message: "Phone number not registered with any parent." }
  }

  const pendingApprovals = await leaveApprovalRepository.findPendingByParentPhone(from)

  if (pendingApprovals.length === 0) {
    return { message: "No pending leave requests found." }
  }

  const approval = pendingApprovals.length === 1 && !parsed.shortCode
    ? pendingApprovals[0]
    : pendingApprovals.find(
        (a) => a.id.replace(/-/g, "").slice(-8).toLowerCase() === parsed.shortCode
      )

  if (!approval) {
    return { message: "Leave code not found. Check the code and try again." }
  }

  const leaveRequestId = approval.leaveRequestId
  if (!leaveRequestId) {
    return { message: "Leave request not found." }
  }

  const isApproved = parsed.action === "APPROVE"

  // Find which parent this approval belongs to (handles siblings sharing a phone)
  const matchingParent = (parents.find((p) => p.id === approval.approverParentId) ?? parents[0])!

  await transaction(async (tx) => {
    const updated = await leaveApprovalRepository.updateParentDecision(
      approval.id,
      matchingParent.id,
      isApproved ? LEAVE_APPROVAL_DECISION.APPROVED : LEAVE_APPROVAL_DECISION.REJECTED,
      `Processed via SMS reply from ${from}`,
      tx,
      LEAVE_APPROVAL_SOURCE.SMS_REPLY,
    )

    if (!updated) {
      return
    }

    await auditService.record(
      isApproved ? "APPROVE" as const : "REJECT" as const,
      "LEAVE_APPROVAL" as const,
      approval.id,
      matchingParent.id,
      {
        leaveRequestId,
        approvalSource: LEAVE_APPROVAL_SOURCE.SMS_REPLY,
      },
      tx
    )

    if (!isApproved) {
      await leaveRepository.updateById(
        leaveRequestId,
        {
          status: LEAVE_REQUEST_STATUS.REJECTED,
          rejectedAt: new Date(),
          currentStepKey: null,
          currentStepOrder: null,
        },
        tx
      )

      await outboxService.publish({
        eventType: OUTBOX_EVENT_TYPE.LEAVE_REJECTED,
        aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
        aggregateId: leaveRequestId,
        payload: { leaveRequestId },
      }, tx)
    } else {
      const next = await leaveApprovalRepository.findNextByEntityAndDecision(
        leaveRequestId,
        leaveApprovals.leaveRequestId,
        approval.stepOrder,
        LEAVE_APPROVAL_DECISION.PENDING,
        tx
      )

      if (next) {
        await leaveRepository.updateCurrentStep(
          leaveRequestId,
          next.stepKey,
          next.stepOrder,
          tx
        )
      } else {
        await leaveRepository.updateById(
          leaveRequestId,
          {
            status: LEAVE_REQUEST_STATUS.APPROVED,
            approvedAt: new Date(),
            currentStepKey: null,
            currentStepOrder: null,
          },
          tx
        )

        await outboxService.publish({
          eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVED,
          aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
          aggregateId: leaveRequestId,
          payload: { leaveRequestId },
        }, tx)

        const approvedLeave = await leaveRepository.findById(leaveRequestId, tx)
        if (approvedLeave?.studentId) {
          await recordMovement({
            studentId: approvedLeave.studentId,
            leaveRequestId,
            fromState: MOVEMENT_STATE.IN_HOSTEL,
            toState: MOVEMENT_STATE.APPROVED_LEAVE,
            eventType: MOVEMENT_EVENT.LEAVE_APPROVED,
            movementMethod: MOVEMENT_METHOD.SYSTEM,
            dbClient: tx,
          })
        }
      }
    }
  })

  return {
    message: isApproved ? "Leave request approved." : "Leave request rejected.",
  }
}
