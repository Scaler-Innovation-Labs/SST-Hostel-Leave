import { logger } from "@/lib/logger"
import { createEmailProvider as createMessagingEmailProvider } from "@/lib/messaging"

import type {
  NotificationPayload,
  NotificationSendResult,
} from "./notification-provider"

let provider: ReturnType<typeof createMessagingEmailProvider> | null = null;

function getProvider() {
  if (!provider) {
    provider = createMessagingEmailProvider();
  }
  return provider;
}

export function createEmailProvider() {
  return {
    async send(
      payload: NotificationPayload,
    ): Promise<NotificationSendResult> {
      const devRedirect =
        process.env.NODE_ENV === "development"
          ? process.env.DEV_EMAIL_REDIRECT?.trim() || undefined
          : undefined;
      const isDevRedirect = Boolean(devRedirect);
      const actualTo = isDevRedirect ? devRedirect! : payload.to;
      const originalTo = Array.isArray(payload.to) ? payload.to.join(", ") : payload.to;

      if (isDevRedirect && payload.to !== devRedirect) {
        logger.info("Dev mode email redirect", {
          from: originalTo,
          to: actualTo,
          suppressedCcCount: payload.cc?.length ?? 0,
          subject: payload.subject,
        });
      }

      try {
        const result = await getProvider().send({
          to: actualTo,
          subject: payload.subject ?? "No Subject",
          text: payload.body,
          // When the notification service provides an escaped HTML render it
          // wins; otherwise fall back to the legacy per-line <p> wrap (no
          // escaping — used only for direct provider calls / tests).
          html: payload.htmlBody ?? payload.body.split("\n").map((line) => `<p>${line}</p>`).join(""),
          // Never leak real CC addresses when redirecting emails in dev mode.
          cc: !isDevRedirect && payload.cc && payload.cc.length > 0 ? payload.cc : undefined,
        })

        return {
          success: result.success,
          messageId: result.messageId ?? `ses-${Date.now()}`,
          error: result.error,
        }
      } catch (error) {
        logger.error("Email provider send failed", { error: error instanceof Error ? error.message : String(error) })
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    },
  }
}
