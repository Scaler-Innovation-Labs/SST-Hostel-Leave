import { createSmsWebhookAdapter } from "@/lib/messaging/sms/webhook"
import { handleIncomingSms } from "@/services/parent/inbound-sms.service"

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? ""
    let rawBody: string
    let parsed: Record<string, unknown>

    if (contentType.includes("application/x-www-form-urlencoded")) {
      rawBody = await request.text()
      const params = new URLSearchParams(rawBody)
      parsed = Object.fromEntries(params.entries())
    } else {
      rawBody = await request.text()
      parsed = JSON.parse(rawBody)
    }

    const adapter = createSmsWebhookAdapter()

    const isValid = await adapter.validate(request, rawBody)
    if (!isValid) {
      return new Response("Unauthorized", { status: 403 })
    }

    const inbound = adapter.parse(parsed)

    if (!inbound.from || !inbound.body) {
      return new Response("Invalid request", { status: 200 })
    }

    const isDuplicate = inbound.providerMessageId
      ? await adapter.isDuplicate(inbound.providerMessageId)
      : false
    if (isDuplicate) {
      return new Response(JSON.stringify({ success: true, message: "Duplicate ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const result = await handleIncomingSms(inbound.from, inbound.body)

    if (adapter.provider === "twilio") {
      return new Response(twiml(result.message), {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      })
    }

    return new Response(JSON.stringify({ success: true, message: result.message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch {
    return new Response("Internal server error", { status: 500 })
  }
}

function twiml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
}
