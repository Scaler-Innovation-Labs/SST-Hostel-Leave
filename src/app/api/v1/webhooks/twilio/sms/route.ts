import { ApiResponse } from "@/lib/api/response";
import { handleTwilioWebhook } from "@/services/parent/twilio-sms.service";

async function validateTwilioRequest(request: Request, text: string): Promise<boolean> {
  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const url = request.url;

  const { validateRequest } = await import("twilio/lib/webhooks/webhooks");
  return validateRequest(authToken, signature, url, new URLSearchParams(text));
}

export async function POST(request: Request) {
  try {
    const text = await request.text();

    const isValid = await validateTwilioRequest(request, text);
    if (!isValid) {
      return new Response("Invalid signature", { status: 403 });
    }

    const params = new URLSearchParams(text);
    const from = params.get("From") ?? "";
    const body = params.get("Body") ?? "";

    return handleTwilioWebhook(from, body);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
