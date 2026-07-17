import twilio from "twilio"

import { logger } from "@/lib/logger"
import { getConfig } from "@/lib/messaging/config"

import type { SmsPayload, SmsProvider, SmsResult } from "./provider"

export class TwilioSmsProvider implements SmsProvider {
  private clientInstance: ReturnType<typeof twilio> | null = null

  private getClient(accountSid: string, authToken: string) {
    if (!this.clientInstance) {
      this.clientInstance = twilio(accountSid, authToken)
    }
    return this.clientInstance
  }

  async send(payload: SmsPayload): Promise<SmsResult> {
    try {
      const config = getConfig()
      const { accountSid, authToken, fromNumber, messagingServiceSid } = config.sms.twilio ?? {}

      if (!accountSid || !authToken) {
        return {
          success: false,
          error: "Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
        }
      }

      const from = messagingServiceSid ? undefined : fromNumber
      if (!messagingServiceSid && !from) {
        return {
          success: false,
          error: "TWILIO_PHONE_NUMBER is not configured",
        }
      }

      let normalizedPhone = payload.to.startsWith("+") ? payload.to : `+${payload.to}`

      if (config.defaults.testMode && config.defaults.testRecipient) {
        const originalRecipient = normalizedPhone
        normalizedPhone = config.defaults.testRecipient.startsWith("+")
          ? config.defaults.testRecipient
          : `+${config.defaults.testRecipient}`

        payload = {
          ...payload,
          body: `[TO ${originalRecipient}] ${payload.body}`,
        }
      }

      const client = this.getClient(accountSid, authToken)
      const messageParams: Parameters<typeof client.messages.create>[0] = {
        to: normalizedPhone,
        body: payload.body,
      }

      if (messagingServiceSid) {
        messageParams.messagingServiceSid = messagingServiceSid
      } else if (from) {
        messageParams.from = from
      }

      const result = await client.messages.create(messageParams)

      return {
        success: true,
        messageId: result.sid,
      }
    } catch (error) {
      logger.error("Twilio SMS send failed", { error: error instanceof Error ? error.message : String(error) })
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
