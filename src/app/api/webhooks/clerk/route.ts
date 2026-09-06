import type { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { Webhook } from "svix";

import { ApiResponse } from "@/lib/api/response";
import { ConfigurationError,ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { handleClerkWebhookEvent } from "@/services/user/clerk-webhook.service";

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
    let evt;
    try {
      evt = await validateRequest(request);
    } catch (error) {
      // Security signal: forged or misconfigured webhook deliveries.
      // svix-id is a sender-generated message id, safe to log.
      const headerPayload = await headers();
      logger.warn("Clerk webhook verification failed", {
        svixId: headerPayload.get("svix-id") ?? "missing",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    await handleClerkWebhookEvent(evt);

    return ApiResponse.success({});
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
