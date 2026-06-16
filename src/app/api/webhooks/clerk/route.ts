import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { handleClerkWebhookEvent } from "@/services/user/clerk-webhook.service";
import { ValidationError, ConfigurationError } from "@/lib/errors";

async function validateRequest(request: Request): Promise<WebhookEvent> {
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new ValidationError("Missing svix headers");
  }

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    throw new ConfigurationError("Missing CLERK_WEBHOOK_SECRET");
  }

  const wh = new Webhook(secret);
  const payload = await request.text();

  return wh.verify(payload, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  }) as WebhookEvent;
}

export async function POST(request: Request) {
  try {
    const evt = await validateRequest(request);

    await handleClerkWebhookEvent(evt);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Invalid signature" },
      { status: 400 },
    );
  }
}
