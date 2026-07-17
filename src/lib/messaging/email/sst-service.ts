import { logger } from "@/lib/logger"

import type { EmailPayload, EmailProvider, EmailResult } from "./provider"

type SstSendResponse = {
  success: boolean
  status: number
  data: {
    jobId: string
    status: string
    totalRecipients: number
    deduplicated: number
    replay: boolean
  }
}

type SstErrorResponse = {
  success: false
  status: number
  code: string
  message: string
}

export class SstEmailProvider implements EmailProvider {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.EMAIL_SERVICE_URL ?? ""
    this.apiKey = process.env.EMAIL_SERVICE_API_KEY ?? ""
  }

  async send(payload: EmailPayload): Promise<EmailResult> {
    if (!this.baseUrl || !this.apiKey) {
      return { success: false, error: "SST email service is not configured. Set EMAIL_SERVICE_URL and EMAIL_SERVICE_API_KEY." }
    }

    const toAddresses = Array.from(new Set(Array.isArray(payload.to) ? payload.to : [payload.to]))

    const descriptionHtml = payload.html ?? (payload.text ? payload.text.split("\n").map((l) => `<p>${this.escapeHtml(l)}</p>`).join("") : undefined)

    try {
      const response = await fetch(`${this.baseUrl}/v1/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
        },
        body: JSON.stringify({
          to: toAddresses,
          subject: payload.subject,
          replyTo: payload.replyTo,
          idempotencyKey: payload.template ? `${payload.template}-${Date.now()}` : undefined,
          content: {
            templateId: "announcement",
            variables: {
              title: payload.subject,
              authorName: "SST Hostel Leave",
              dashboardUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "https://sst-dashboard.com",
              descriptionHtml,
              category: payload.template ? payload.template.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "Notification",
            },
          },
        }),
      })

      const json = await response.json() as SstSendResponse | SstErrorResponse

      if (!response.ok || !json.success) {
        const err = json as SstErrorResponse
        logger.error("SST email service send failed", { status: response.status, code: err.code, message: err.message })
        return { success: false, error: err.message ?? `SST email service returned ${response.status}` }
      }

      const data = json.data
      logger.info("SST email queued", { jobId: data.jobId, recipients: data.totalRecipients })

      return { success: true, messageId: data.jobId }
    } catch (error) {
      logger.error("SST email service request failed", { error: error instanceof Error ? error.message : String(error) })
      return { success: false, error: error instanceof Error ? error.message : "Failed to send via SST email service" }
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }
}
