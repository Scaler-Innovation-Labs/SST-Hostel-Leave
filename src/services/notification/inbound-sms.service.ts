import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { leaveParentApprovalRepository } from "@/db/repositories/leave/leave-parent-approval.repository";
import { inboundSmsLogRepository } from "@/db/repositories/parent/inbound-sms-log.repository";
import { parentRepository } from "@/db/repositories/parent/parent.repository";
import { logger } from "@/lib/logger";
import { parentApproveDecision } from "@/services/parent/parent-approve-decision.service";

const SMS_APPROVE_RE = /^(?:1|approve|yes)\s+([a-zA-Z0-9-]+)/i;
const SMS_REJECT_RE = /^(?:2|reject|no)\s+([a-zA-Z0-9-]+)/i;

export type SmsReplyResult = {
  processed: boolean;
  message: string;
};

function parseSmsAction(text: string): { action: "APPROVE" | "REJECT"; leaveId: string } | null {
  const approveMatch = text.trim().match(SMS_APPROVE_RE);
  if (approveMatch) return { action: "APPROVE", leaveId: approveMatch[1]! };

  const rejectMatch = text.trim().match(SMS_REJECT_RE);
  if (rejectMatch) return { action: "REJECT", leaveId: rejectMatch[1]! };

  return null;
}

async function logSms(data: {
  phone: string;
  message: string;
  providerMessageId: string;
  parsedAction?: "APPROVE" | "REJECT" | "UNKNOWN";
  processingStatus: "RECEIVED" | "PARSED" | "PROCESSED" | "FAILED";
  parentId?: string;
  leaveRequestId?: string;
  leaveExtensionId?: string;
}): Promise<void> {
  await inboundSmsLogRepository.create({
    phone: data.phone,
    message: data.message,
    providerMessageId: data.providerMessageId,
    parsedAction: data.parsedAction ?? "UNKNOWN",
    processingStatus: data.processingStatus,
    parentId: data.parentId ?? null,
    leaveRequestId: data.leaveRequestId ?? null,
    leaveExtensionId: data.leaveExtensionId ?? null,
  });
}

export const inboundSmsService = {
  async processReply(
    fromPhone: string,
    messageText: string,
    providerMessageId: string,
  ): Promise<SmsReplyResult> {
    const existing = await inboundSmsLogRepository.findByProviderMessageId(providerMessageId);
    if (existing) {
      return { processed: false, message: "Duplicate SMS ignored" };
    }

    const parsed = parseSmsAction(messageText);
    if (!parsed) {
      await logSms({
        phone: fromPhone,
        message: messageText,
        providerMessageId,
        parsedAction: "UNKNOWN",
        processingStatus: "FAILED",
      });
      return { processed: false, message: "Could not parse SMS action. Reply with 1 <leaveId> to approve or 2 <leaveId> to reject." };
    }

    const parent = await parentRepository.findByPhone(fromPhone);
    if (!parent) {
      await logSms({
        phone: fromPhone,
        message: messageText,
        providerMessageId,
        parsedAction: parsed.action,
        processingStatus: "FAILED",
      });
      return { processed: false, message: "No parent found with this phone number" };
    }

    const approval = await leaveParentApprovalRepository.findByParentPhoneAndLeaveRequest(
      fromPhone,
      parsed.leaveId,
    );

    if (!approval) {
      const extApproval = await leaveParentApprovalRepository.findByParentPhoneAndExtensionRequest(
        fromPhone,
        parsed.leaveId,
      );

      if (!extApproval) {
        await logSms({
          phone: fromPhone,
          message: messageText,
          providerMessageId,
          parsedAction: parsed.action,
          processingStatus: "FAILED",
          parentId: parent.id,
        });
        return { processed: false, message: "No pending approval found for this leave ID" };
      }

      return await processApproval(parent.id, fromPhone, messageText, providerMessageId, parsed, extApproval);
    }

    return await processApproval(parent.id, fromPhone, messageText, providerMessageId, parsed, approval);
  },
};

async function processApproval(
  parentId: string,
  fromPhone: string,
  messageText: string,
  providerMessageId: string,
  parsed: { action: "APPROVE" | "REJECT"; leaveId: string },
  approval: { id: string; leaveRequestId: string | null; leaveExtensionId: string | null },
): Promise<SmsReplyResult> {
  try {
    const dto = {
      decision: parsed.action === "APPROVE" ? LEAVE_APPROVAL_DECISION.APPROVED : LEAVE_APPROVAL_DECISION.REJECTED,
      comments: "Approved via SMS reply",
    };

    const result = await parentApproveDecision("", dto, approval.id);

    await logSms({
      parentId,
      leaveRequestId: approval.leaveRequestId ?? undefined,
      leaveExtensionId: approval.leaveExtensionId ?? undefined,
      phone: fromPhone,
      message: messageText,
      providerMessageId,
      parsedAction: parsed.action,
      processingStatus: "PROCESSED",
    });

    logger.info("SMS reply processed", {
      action: parsed.action,
      leaveId: parsed.leaveId,
      parentId,
      result: result.decision,
    });

    return {
      processed: true,
      message: `${parsed.action === "APPROVE" ? "Approved" : "Rejected"} leave ${parsed.leaveId}`,
    };
  } catch (error) {
    logger.error("SMS reply processing failed", { error: error instanceof Error ? error.message : String(error) });

    await logSms({
      parentId,
      leaveRequestId: approval.leaveRequestId ?? undefined,
      leaveExtensionId: approval.leaveExtensionId ?? undefined,
      phone: fromPhone,
      message: messageText,
      providerMessageId,
      parsedAction: parsed.action,
      processingStatus: "FAILED",
    });

    return { processed: false, message: "Failed to process approval" };
  }
}
