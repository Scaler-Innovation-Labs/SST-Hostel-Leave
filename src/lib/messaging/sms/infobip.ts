import { logger } from "@/lib/logger"
import { getCircuitBreaker } from "@/lib/messaging/circuit-breaker"
import { withRetry } from "@/lib/messaging/retry"

import type { SmsPayload, SmsProvider, SmsResult } from "./provider"

const DEFAULT_BASE_URL = "https://api.infobip.com"

// Infobip per-message status groups: 1 = PENDING, 2 = ACCEPTED.
// Any other group (e.g. 3 = REJECTED) means the operator refused the message
// (e.g. DLT template mismatch or invalid custom domain).
const ACCEPTED_STATUS_GROUPS = new Set([1, 2])

export class InfobipSmsProvider implements SmsProvider {
  private readonly circuitBreaker = getCircuitBreaker("infobip-sms")

  async send(payload: SmsPayload): Promise<SmsResult> {
    try {
      const apiKey = process.env.INFOBIP_API_KEY
      if (!apiKey) {
        return {
          success: false,
          error: "Infobip is not configured. Set INFOBIP_API_KEY.",
        }
      }

      const sender = process.env.INFOBIP_SENDER_ID
      if (!sender) {
        return {
          success: false,
          error: "Infobip is not configured. Set INFOBIP_SENDER_ID.",
        }
      }

      const contentTemplateId = process.env.INFOBIP_DLT_CONTENT_TEMPLATE_ID
      const principalEntityId = process.env.INFOBIP_DLT_PRINCIPAL_ENTITY_ID
      if (!contentTemplateId || !principalEntityId) {
        return {
          success: false,
          error:
            "Infobip DLT is not configured. Set INFOBIP_DLT_CONTENT_TEMPLATE_ID and INFOBIP_DLT_PRINCIPAL_ENTITY_ID.",
        }
      }

      const baseUrl = process.env.INFOBIP_BASE_URL ?? DEFAULT_BASE_URL

      let to = payload.to.startsWith("+") ? payload.to.slice(1) : payload.to

      const testMode = process.env.SMS_TEST_MODE === "true"
      const testRecipient = process.env.SMS_TO_NUMBER

      if (testMode && testRecipient) {
        logger.info("Infobip SMS test mode: redirecting message", { from: to, to: testRecipient })
        to = testRecipient.startsWith("+") ? testRecipient.slice(1) : testRecipient
      }

      const trackingOptions: Record<string, unknown> = {
        shortenUrl: true,
        trackClicks: true,
      }

      const customDomain = process.env.INFOBIP_CUSTOM_DOMAIN
      if (customDomain) {
        trackingOptions.customDomain = customDomain
      }

      const result = await this.circuitBreaker.call(() =>
        withRetry(async () => {
          const response = await fetch(`${baseUrl}/sms/3/messages`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${apiKey}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              messages: [
                {
                  sender,
                  destinations: [{ to }],
                  content: { text: payload.body },
                  options: {
                    regional: {
                      indiaDlt: {
                        contentTemplateId,
                        principalEntityId,
                      },
                    },
                  },
                },
              ],
              options: {
                tracking: trackingOptions,
              },
            }),
          })

          if (!response.ok) {
            const errorBody = await response.json().catch(() => null)
            throw new InfobipApiError(
              response.status,
              extractApiErrorText(errorBody) ?? response.statusText,
            )
          }

          const data = await response.json()
          const message = data?.messages?.[0]
          const statusGroup = message?.status?.groupId

          if (typeof statusGroup === "number" && !ACCEPTED_STATUS_GROUPS.has(statusGroup)) {
            throw new InfobipApiError(
              response.status,
              `Message rejected: ${message?.status?.description ?? "Unknown status"}`,
            )
          }

          return {
            success: true,
            messageId: message?.messageId ?? `infobip-${Date.now()}`,
          }
        }, {
          onRetry: (error, attempt, delay) => {
            logger.warn("Infobip SMS retry", { attempt, delay, error: String(error) })
          },
        }),
      )

      return result
    } catch (error) {
      if (error instanceof InfobipApiError) {
        return {
          success: false,
          error: `Infobip API error (${error.status}): ${error.message}`,
        }
      }
      logger.error("Infobip SMS send failed", { error: error instanceof Error ? error.message : String(error) })
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

class InfobipApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "InfobipApiError"
  }
}

function extractApiErrorText(errorBody: unknown): string | null {
  if (!errorBody || typeof errorBody !== "object") return null

  const body = errorBody as {
    requestError?: { serviceException?: { text?: string } }
    messages?: Array<{ status?: { description?: string } }>
  }

  if (body.requestError?.serviceException?.text) return body.requestError.serviceException.text
  if (body.messages?.[0]?.status?.description) return body.messages[0].status.description

  return null
}
