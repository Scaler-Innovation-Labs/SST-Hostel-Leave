import { logger } from "@/lib/logger"
import { getCircuitBreaker } from "@/lib/messaging/circuit-breaker"
import { getConfig } from "@/lib/messaging/config"
import { withRetry } from "@/lib/messaging/retry"

import type { SmsPayload, SmsProvider, SmsResult } from "./provider"

export class Msg91SmsProvider implements SmsProvider {
  private readonly baseUrl = "https://api.msg91.com/api/v5/flow"
  private readonly circuitBreaker = getCircuitBreaker("msg91-sms")

  async send(payload: SmsPayload): Promise<SmsResult> {
    try {
      const config = getConfig()
      const msg91Config = config.sms.msg91
      const authKey = msg91Config?.authKey
      const senderId = msg91Config?.senderId

      if (!authKey || !senderId) {
        return {
          success: false,
          error: "MSG91 is not configured. Set MSG91_AUTH_KEY and MSG91_SENDER_ID.",
        }
      }

      const flowId = this.resolveFlowId(payload)

      const recipients = this.buildRecipients(payload, config)
      if (recipients.length === 0) {
        return {
          success: false,
          error: "No valid recipients",
        }
      }

      const body: Record<string, unknown> = {
        sender: senderId,
        recipients,
      }
      if (flowId) {
        body.flow_id = flowId
      }

      const result = await this.circuitBreaker.call(() =>
        withRetry(async () => {
          const response = await fetch(this.baseUrl, {
            method: "POST",
            headers: {
              authkey: authKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          })

          if (!response.ok) {
            throw new Msg91ApiError(response.status, response.statusText)
          }

          const data = await response.json()

          return {
            success: true,
            messageId: data.message ?? undefined,
          }
        }, {
          onRetry: (error, attempt, delay) => {
            logger.warn("MSG91 SMS retry", { attempt, delay, error: String(error) })
          },
        }),
      )

      return result
    } catch (error) {
      if (error instanceof Msg91ApiError) {
        return {
          success: false,
          error: `MSG91 API error: ${error.status}`,
        }
      }
      logger.error("MSG91 SMS send failed", { error: error instanceof Error ? error.message : String(error) })
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private resolveFlowId(payload: SmsPayload): string | undefined {
    if (payload.providerMetadata) {
      const msg91Meta = payload.providerMetadata.msg91 as { flowId?: string } | undefined
      if (msg91Meta?.flowId) return msg91Meta.flowId
    }
    return undefined
  }

  private buildRecipients(
    payload: SmsPayload,
    config: ReturnType<typeof getConfig>,
  ): Array<Record<string, unknown>> {
    let phone = payload.to.startsWith("+") ? payload.to.slice(1) : payload.to
    phone = phone.replace(/[^0-9]/g, "")

    if (config.defaults.testMode && config.defaults.testRecipient) {
      const originalRecipient = phone
      phone = config.defaults.testRecipient.startsWith("+")
        ? config.defaults.testRecipient.slice(1)
        : config.defaults.testRecipient
      phone = phone.replace(/[^0-9]/g, "")

      return [
        {
          mobiles: phone,
          VAR1: `[TO ${originalRecipient}] ${payload.body}`,
          ...this.buildExtraVariables(payload),
        },
      ]
    }

    return [
      {
        mobiles: phone,
        VAR1: payload.body,
        ...this.buildExtraVariables(payload),
      },
    ]
  }

  private buildExtraVariables(payload: SmsPayload): Record<string, string> {
    if (!payload.variables) return {}
    const vars: Record<string, string> = {}
    let idx = 2
    for (const value of Object.values(payload.variables)) {
      vars[`VAR${idx}`] = value
      idx++
    }
    return vars
  }
}

class Msg91ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "Msg91ApiError"
  }
}
