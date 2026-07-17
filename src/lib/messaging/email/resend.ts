import { Resend } from "resend"

import { logger } from "@/lib/logger"

import type { EmailPayload, EmailProvider, EmailResult } from "./provider"

export class ResendEmailProvider implements EmailProvider {
  private clientInstance: Resend | null = null

  private getClient(apiKey: string): Resend {
    if (!this.clientInstance) {
      this.clientInstance = new Resend(apiKey)
    }
    return this.clientInstance
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  async send(payload: EmailPayload): Promise<EmailResult> {
    try {
      const apiKey = process.env.RESEND_API_KEY
      if (!apiKey) {
        return {
          success: false,
          error: "Resend is not configured. Set RESEND_API_KEY.",
        }
      }

      const from = payload.from ?? process.env.RESEND_FROM_EMAIL ?? "SST Hostel <noreply@sst.hostel>"
      const toAddresses = Array.isArray(payload.to) ? payload.to : [payload.to]

      const text = payload.text ?? payload.html?.replace(/<[^>]*>/g, "") ?? ""
      const html = payload.html ?? text.split("\n").map((line) => `<p>${this.escapeHtml(line)}</p>`).join("")

      const { data, error } = await this.getClient(apiKey).emails.send({
        from,
        to: toAddresses,
        cc: payload.cc,
        replyTo: payload.replyTo ? [payload.replyTo] : undefined,
        subject: payload.subject,
        text,
        html,
      })

      if (error) {
        logger.error("Resend email send failed", { error: error.message })
        return {
          success: false,
          error: error.message ?? "Resend API error",
        }
      }

      return {
        success: true,
        messageId: data?.id,
      }
    } catch (error) {
      logger.error("Resend email send failed", { error: error instanceof Error ? error.message : String(error) })
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
