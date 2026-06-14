import type {
  NotificationPayload,
  NotificationSendResult,
} from "./notification-provider";

import { sendEmail } from "@/lib/resend";

export function createEmailProvider() {
  return {
    async send(
      payload: NotificationPayload,
    ): Promise<NotificationSendResult> {
      const resendConfigured = !!process.env.RESEND_API_KEY;

      if (!resendConfigured) {
        console.warn(
          `[EMAIL STUB] To: ${payload.to} | Subject: ${payload.subject} | Body: ${payload.body}`,
        );
        return {
          success: false,
          error:
            "Resend is not configured. Set RESEND_API_KEY.",
        };
      }

      const result = await sendEmail(
        payload.to,
        payload.subject ?? "No Subject",
        payload.body,
      );

      return {
        success: result.success,
        messageId: result.messageId ?? `resend-${Date.now()}`,
        error: result.error,
      };
    },
  };
}
