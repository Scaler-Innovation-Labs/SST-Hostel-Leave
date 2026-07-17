import { handleIncomingSms } from "@/services/parent/inbound-sms.service";

export async function handleTwilioWebhook(from: string, body: string): Promise<Response> {
  const result = await handleIncomingSms(from, body);
  return new Response(result.message, { status: 200 });
}
