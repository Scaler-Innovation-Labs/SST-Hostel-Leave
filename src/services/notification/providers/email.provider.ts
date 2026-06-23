import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/resend";

import type {
  NotificationPayload,
  NotificationSendResult,
} from "./notification-provider";

const DEV_REDIRECT_EMAIL = "n.vedvarshit@gmail.com";

export function createEmailProvider() {
  return {
    async send(
      payload: NotificationPayload,
    ): Promise<NotificationSendResult> {
      const resendConfigured = !!process.env.RESEND_API_KEY;

      if (!resendConfigured) {
        logger.warn("Email not configured — EMAIL STUB", { to: payload.to });
        return {
          success: false,
          error:
            "Resend is not configured. Set RESEND_API_KEY.",
        };
      }

      const actualTo = process.env.NODE_ENV === "development" ? DEV_REDIRECT_EMAIL : payload.to;

      if (process.env.NODE_ENV === "development" && actualTo !== payload.to) {
        logger.info("Dev mode email redirect", { from: payload.to, to: actualTo, subject: payload.subject });
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
