import {
  SESClient,
  SendEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-ses"

import { logger } from "@/lib/logger"
import { withRetry } from "@/lib/messaging/retry"

import type { EmailPayload, EmailProvider, EmailResult } from "./provider"

export class SesEmailProvider implements EmailProvider {
  private client: SESClient | null = null

  private getClient(region: string): SESClient {
    if (!this.client) {
      this.client = new SESClient({ region })
    }
    return this.client
  }

  async send(payload: EmailPayload): Promise<EmailResult> {
    try {
      const region = process.env.AWS_REGION
      const fromEmail = payload.from ?? process.env.SES_FROM_EMAIL

      if (!region) {
        return {
          success: false,
          error: "AWS_REGION is not configured",
        }
      }

      if (!fromEmail) {
        return {
          success: false,
          error: "SES_FROM_EMAIL is not configured",
        }
      }

      if (!payload.to || (Array.isArray(payload.to) && payload.to.length === 0)) {
        return {
          success: false,
          error: "No recipients specified",
        }
      }

      const toAddresses = Array.isArray(payload.to) ? payload.to : [payload.to]

      if (!payload.html && !payload.text) {
        return {
          success: false,
          error: "Either html or text content is required",
        }
      }

      const params: SendEmailCommandInput = {
        Source: fromEmail,
        Destination: {
          ToAddresses: toAddresses,
          CcAddresses: payload.cc,
          BccAddresses: payload.bcc,
        },
        Message: {
          Subject: {
            Data: payload.subject,
            Charset: "UTF-8",
          },
          Body: {},
        },
        ReplyToAddresses: payload.replyTo ? [payload.replyTo] : undefined,
      }

      if (payload.html) {
        params.Message!.Body!.Html = {
          Data: payload.html,
          Charset: "UTF-8",
        }
      }

      if (payload.text) {
        params.Message!.Body!.Text = {
          Data: payload.text,
          Charset: "UTF-8",
        }
      }

      if (!params.Message!.Body!.Html && !params.Message!.Body!.Text) {
        return {
          success: false,
          error: "Failed to build email body content",
        }
      }

      const client = this.getClient(region)
      const command = new SendEmailCommand(params)
      const result = await withRetry(() => client.send(command), {
        onRetry: (error, attempt, delay) => {
          logger.warn("SES email send retry", { attempt, delay, error: String(error) })
        },
      })

      return {
        success: true,
        messageId: result.MessageId,
      }
    } catch (error) {
      logger.error("SES email send failed", { error: error instanceof Error ? error.message : String(error) })
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
