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

    function announcementContent(): Record<string, unknown> {
      const descriptionHtml = (payload.html ?? payload.text ?? "").split("\n").map((l) => `<p>${l}</p>`).join("")
      return {
        templateId: "announcement",
        variables: {
          title: payload.subject,
          authorName: "SST Hostel Leave",
          dashboardUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "https://sst-dashboard.com",
          descriptionHtml,
          category: payload.template ? payload.template.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "Notification",
        },
      }
    }

    async function trySend(content: Record<string, unknown>): Promise<{ ok: boolean; json: SstSendResponse | SstErrorResponse }> {
      const response = await fetch(`${this.baseUrl}/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": this.apiKey },
        body: JSON.stringify({
          to: toAddresses,
          subject: payload.subject,
          replyTo: payload.replyTo,
          idempotencyKey: payload.template ? `${payload.template}-${Date.now()}` : undefined,
          content,
        }),
      })
      const json = await response.json() as SstSendResponse | SstErrorResponse
      return { ok: response.ok && json.success, json }
    }

    try {
      let content: Record<string, unknown>
      // Prefer raw HTML when payload.html is provided (requires raw-html scope on API key)
      if (payload.html) {
        content = { html: payload.html, text: payload.text ?? "" }
        const result = await trySend(content)
        if (result.ok) {
          const data = (result.json as SstSendResponse).data
          logger.info("SST email queued", { jobId: data.jobId, recipients: data.totalRecipients })
          return { success: true, messageId: data.jobId }
        }
        const err = result.json as SstErrorResponse
        logger.warn("Raw HTML send failed — falling back to announcement template", { status: err.status, code: err.code })
        content = announcementContent()
      } else {
        content = announcementContent()
      }

      const { ok, json } = await trySend(content)
      if (!ok) {
        const err = json as SstErrorResponse
        logger.error("SST email service send failed", { status: err.status, code: err.code, message: err.message })
        return { success: false, error: err.message ?? `SST email service returned ${err.status}` }
      }

      const data = (json as SstSendResponse).data
      logger.info("SST email queued", { jobId: data.jobId, recipients: data.totalRecipients })
      return { success: true, messageId: data.jobId }
    } catch (error) {
      logger.error("SST email service request failed", { error: error instanceof Error ? error.message : String(error) })
      return { success: false, error: error instanceof Error ? error.message : "Failed to send via SST email service" }
    }
  }
}
