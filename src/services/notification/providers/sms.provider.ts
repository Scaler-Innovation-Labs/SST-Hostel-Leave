import type {
  NotificationPayload,
  NotificationSendResult,
} from "./notification-provider";

import { sendSms } from "@/lib/twilio";

export function createSmsProvider() {
  return {
    async send(
      payload: NotificationPayload,
    ): Promise<NotificationSendResult> {
      const twilioConfigured =
        !!process.env.TWILIO_ACCOUNT_SID &&
        !!process.env.TWILIO_AUTH_TOKEN &&
        !!process.env.TWILIO_PHONE_NUMBER;

      if (!twilioConfigured) {
        console.warn(
          `[SMS STUB] To: ${payload.to} | Body: ${payload.body}`,
        );
        return {
          success: false,
          error:
            "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
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
