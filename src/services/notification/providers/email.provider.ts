import type {
  NotificationPayload,
  NotificationSendResult,
} from "./notification-provider";

import { sendEmail } from "@/lib/resend";

const DEV_REDIRECT_EMAIL = "n.vedvarshit@gmail.com";

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

      const actualTo = process.env.NODE_ENV === "development" ? DEV_REDIRECT_EMAIL : payload.to;

      if (process.env.NODE_ENV === "development" && actualTo !== payload.to) {
        console.info(`[DEV EMAIL] Redirecting "${payload.subject}" from ${payload.to} to ${actualTo}`);
      }

      const result = await sendEmail(
        actualTo,
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
