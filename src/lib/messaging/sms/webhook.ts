import { createHmac, timingSafeEqual } from "node:crypto"

import { inboundSmsLogRepository } from "@/db/repositories/parent/inbound-sms-log.repository"

export type InboundSmsPayload = {
  provider: string
  from: string
  body: string
  providerMessageId?: string
  raw: Record<string, unknown>
}

export type InboundSmsWebhookResult = {
  success: boolean
  action?: "APPROVE" | "REJECT"
  shortCode?: string
}

export interface SmsWebhookAdapter {
  readonly provider: string

  validate(request: Request, body: string): Promise<boolean>
  parse(payload: Record<string, unknown>): InboundSmsPayload
  isDuplicate(providerMessageId: string): Promise<boolean>
}

export function createSmsWebhookAdapter(provider?: string): SmsWebhookAdapter {
  const detected = provider ?? detectProvider()
  switch (detected) {
    case "twilio":
      return new TwilioSmsWebhookAdapter()
    case "msg91":
      return new Msg91SmsWebhookAdapter()
    default:
      return new TwilioSmsWebhookAdapter()
  }
}

function detectProvider(): string {
  return process.env.SMS_PROVIDER ?? "msg91"
}

const WEBHOOK_TIMESTAMP_TOLERANCE_SEC = 300

class TwilioSmsWebhookAdapter implements SmsWebhookAdapter {
  readonly provider = "twilio"

  async validate(request: Request, text: string): Promise<boolean> {
    const signature = request.headers.get("x-twilio-signature")
    if (!signature) return false

    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (!authToken) return false

    try {
      const { validateRequest } = await import("twilio/lib/webhooks/webhooks")
      return validateRequest(authToken, signature, request.url, new URLSearchParams(text))
    } catch {
      return false
    }
  }

  parse(payload: Record<string, unknown>): InboundSmsPayload {
    return {
      provider: "twilio",
      from: (payload.From as string) ?? "",
      body: (payload.Body as string) ?? "",
      providerMessageId: (payload.SmsSid as string) ?? undefined,
      raw: payload,
    }
  }

  async isDuplicate(providerMessageId: string): Promise<boolean> {
    if (!providerMessageId) return false;
    const existing = await inboundSmsLogRepository.findByProviderMessageId(providerMessageId);
    if (existing && existing.processingStatus !== "FAILED") return true;
    return false;
  }
}

class Msg91SmsWebhookAdapter implements SmsWebhookAdapter {
  readonly provider = "msg91"

  async validate(request: Request, body: string): Promise<boolean> {
    const authKey = process.env.MSG91_AUTH_KEY
    if (!authKey) return false

    const signature = request.headers.get("x-msg91-signature")
    if (!signature) return false

    const timestamp = request.headers.get("x-msg91-timestamp")
    if (!timestamp) return false

    const now = Math.floor(Date.now() / 1000)
    if (now - parseInt(timestamp, 10) > WEBHOOK_TIMESTAMP_TOLERANCE_SEC) {
      return false
    }

    const payload = `${timestamp}.${body}`
    const expected = createHmac("sha256", authKey).update(payload).digest("hex")

    const sigBuf = Buffer.from(signature, "hex")
    const expectedBuf = Buffer.from(expected, "hex")

    if (sigBuf.length !== expectedBuf.length) return false

    return timingSafeEqual(sigBuf, expectedBuf)
  }

  parse(payload: Record<string, unknown>): InboundSmsPayload {
    return {
      provider: "msg91",
      from: (payload.sender as string) ?? (payload.from as string) ?? "",
      body: (payload.text as string) ?? (payload.message as string) ?? "",
      providerMessageId: (payload.msgId as string) ?? undefined,
      raw: payload,
    }
  }

  async isDuplicate(providerMessageId: string): Promise<boolean> {
    if (!providerMessageId) return false;
    const existing = await inboundSmsLogRepository.findByProviderMessageId(providerMessageId);
    if (existing && existing.processingStatus !== "FAILED") return true;
    return false;
  }
}

export function parseSmsAction(body: string): { action: "APPROVE" | "REJECT"; shortCode?: string } | null {
  const upper = body.trim().toUpperCase()

  const approveMatch = upper.match(/^(?:1|APPROVE)\s*([A-F0-9]{1,8})?$/)
  if (approveMatch) {
    return { action: "APPROVE", shortCode: approveMatch[1]?.toLowerCase() }
  }

  const rejectMatch = upper.match(/^(?:2|REJECT)\s*([A-F0-9]{1,8})?$/)
  if (rejectMatch) {
    return { action: "REJECT", shortCode: rejectMatch[1]?.toLowerCase() }
  }

  return null
}
