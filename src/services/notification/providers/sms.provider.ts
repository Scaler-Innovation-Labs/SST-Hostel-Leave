import { logger } from "@/lib/logger";
import { sendSms } from "@/lib/twilio";

import type {
  NotificationPayload,
  NotificationSendResult,
} from "./notification-provider";

export function createSmsProvider() {
  return {
    async send(
      payload: NotificationPayload,
    ): Promise<NotificationSendResult> {
      const twilioConfigured =
        !!process.env.TWILIO_ACCOUNT_SID &&
        !!process.env.TWILIO_AUTH_TOKEN &&
        (!!process.env.TWILIO_PHONE_NUMBER || !!process.env.TWILIO_FROM_NUMBER || !!process.env.TWILIO_MESSAGING_SERVICE_SID);

      if (!twilioConfigured) {
        logger.warn("SMS not configured — SMS STUB", { to: payload.to });
        return {
          success: false,
          error:
            "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER (or TWILIO_MESSAGING_SERVICE_SID).",
        };
      }

      const result = await sendSms(payload.to, payload.body);

      return {
        success: result.success,
        messageId: result.messageId ?? `twilio-${Date.now()}`,
        error: result.error,
      };
    },
  };
}
