import { logger } from "@/lib/logger"
import { createEmailProvider as createMessagingEmailProvider } from "@/lib/messaging"

import type {
  NotificationPayload,
  NotificationSendResult,
} from "./notification-provider"

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

const DEV_REDIRECT_EMAIL = "n.vedvarshit@gmail.com"

let provider: ReturnType<typeof createMessagingEmailProvider> | null = null

function getProvider() {
  if (!provider) {
    provider = createMessagingEmailProvider()
  }
  return provider
}

export function createEmailProvider() {
  return {
    async send(
      payload: NotificationPayload,
    ): Promise<NotificationSendResult> {
      const actualTo = process.env.NODE_ENV === "development" ? DEV_REDIRECT_EMAIL : payload.to

      if (process.env.NODE_ENV === "development" && actualTo !== payload.to) {
        logger.info("Dev mode email redirect", { from: payload.to, to: actualTo, subject: payload.subject })
      }

      try {
        const result = await getProvider().send({
          to: actualTo,
          subject: payload.subject ?? "No Subject",
          text: payload.body,
          html: payload.body.split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join(""),
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
