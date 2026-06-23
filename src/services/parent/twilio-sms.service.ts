import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { parentRepository } from "@/db/repositories/hostel/parent.repository";
import { transaction } from "@/lib/db/transaction";
import { auditService } from "@/services/audit/audit.service";
import { recordMovement } from "@/services/movement/record-movement.service";
import { outboxService } from "@/services/outbox/outbox.service";

type SmsAction = "APPROVE" | "REJECT";

function parseSmsBody(body: string): { action: SmsAction; shortCode?: string } | null {
  const upper = body.trim().toUpperCase();

  const approveMatch = upper.match(/^(?:1|APPROVE)\s*([A-F0-9]{1,8})?$/);
  if (approveMatch) {
    return { action: "APPROVE", shortCode: approveMatch[1]?.toLowerCase() };
  }

  const rejectMatch = upper.match(/^(?:2|REJECT)\s*([A-F0-9]{1,8})?$/);
  if (rejectMatch) {
    return { action: "REJECT", shortCode: rejectMatch[1]?.toLowerCase() };
  }

  return null;
}

export type TwilioSmsResult = {
  twiml: string;
};

export async function handleIncomingSms(from: string, body: string): Promise<TwilioSmsResult> {
  const parsed = parseSmsBody(body);
  if (!parsed) {
    return { twiml: "Reply 1 <code> to approve or 2 <code> to reject." };
  }

  const parent = await parentRepository.findByPhone(from);
  if (!parent) {
    return { twiml: "Phone number not registered with any parent." };
  }

  const pendingApprovals = await leaveApprovalRepository.findPendingByParentPhone(from);

  if (pendingApprovals.length === 0) {
    return { twiml: "No pending leave requests found." };
  }

  const approval = pendingApprovals.length === 1 && !parsed.shortCode
    ? pendingApprovals[0]
    : pendingApprovals.find(
        (a: { id: string }) => a.id.replace(/-/g, "").slice(-8).toLowerCase() === parsed.shortCode
      );

  if (!approval) {
    return { twiml: "Leave code not found. Check the code and try again." };
  }

  const leaveRequestId = approval.leaveRequestId;
  if (!leaveRequestId) {
    return { twiml: "Leave request not found." };
  }

  const isApproved = parsed.action === "APPROVE";

  await transaction(async (tx) => {
    const updated = await leaveApprovalRepository.updateParentDecision(
      approval.id,
      parent.id,
      isApproved ? "APPROVED" as const : "REJECTED" as const,
      `Processed via SMS reply from ${from}`,
      tx,
      LEAVE_APPROVAL_SOURCE.SMS_REPLY,
    );

    if (!updated) {
      return;
    }

    await auditService.record(
      isApproved ? "APPROVE" as const : "REJECT" as const,
      "LEAVE_APPROVAL" as const,
      approval.id,
      parent.id,
      {
        leaveRequestId,
        approvalSource: LEAVE_APPROVAL_SOURCE.SMS_REPLY,
      },
      tx
    );

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
      );

      await outboxService.publish({
        eventType: OUTBOX_EVENT_TYPE.LEAVE_REJECTED,
        aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
        aggregateId: leaveRequestId,
        payload: { leaveRequestId },
      }, tx);
    } else {
      const next = await leaveApprovalRepository.findNextByDecision(
        leaveRequestId,
        approval.stepOrder,
        LEAVE_APPROVAL_DECISION.PENDING,
        tx
      );

      if (next) {
        await leaveRepository.updateCurrentStep(
          leaveRequestId,
          next.stepKey,
          next.stepOrder,
          tx
        );
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
        );

        await outboxService.publish({
          eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVED,
          aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
          aggregateId: leaveRequestId,
          payload: { leaveRequestId },
        }, tx);

        const approvedLeave = await leaveRepository.findById(leaveRequestId, tx);
        if (approvedLeave?.studentId) {
          await recordMovement({
            studentId: approvedLeave.studentId,
            leaveRequestId,
            fromState: MOVEMENT_STATE.IN_HOSTEL,
            toState: MOVEMENT_STATE.APPROVED_LEAVE,
            eventType: MOVEMENT_EVENT.LEAVE_APPROVED,
            movementMethod: MOVEMENT_METHOD.SYSTEM,
            dbClient: tx,
          });
        }
      }
    }
  });

  return {
    twiml: isApproved ? "Leave request approved." : "Leave request rejected.",
  };
}

function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message></Response>`;
}

export async function handleTwilioWebhook(from: string, body: string): Promise<Response> {
  try {
    if (!from || !body) {
      return new Response(twiml("Invalid request."), {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const result = await handleIncomingSms(from, body);

    return new Response(twiml(result.twiml), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("[TWILIO WEBHOOK] Error:", error);
    return new Response(twiml("An error occurred. Please try again."), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
