import { logger } from "@/lib/logger"
import { SmsTemplate, createSmsProvider as createMessagingSmsProvider } from "@/lib/messaging"

import type {
  NotificationPayload,
  NotificationSendResult,
} from "./notification-provider"

let provider: ReturnType<typeof createMessagingSmsProvider> | null = null

function getProvider() {
  if (!provider) {
    provider = createMessagingSmsProvider()
  }
  return provider
}

export function createSmsProvider() {
  return {
    async send(
      payload: NotificationPayload,
    ): Promise<NotificationSendResult> {
      try {
        const result = await getProvider().send({
          to: payload.to,
          body: payload.body,
          template: payload.templateCode as SmsTemplate | undefined,
          variables: payload.metadata as Record<string, string> | undefined,
          providerMetadata: payload.providerMetadata,
        })

        return {
          success: result.success,
          messageId: result.messageId ?? `msg91-${Date.now()}`,
          error: result.error,
        }
      } catch (error) {
        logger.error("SMS provider send failed", { error: error instanceof Error ? error.message : String(error) })
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    },
  }
}
