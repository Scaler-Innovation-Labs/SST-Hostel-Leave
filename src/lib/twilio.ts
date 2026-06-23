import twilio from "twilio";

import { logger } from "@/lib/logger";

let twilioClientInstance: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (!twilioClientInstance) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error(
        "Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
      );
    }

    twilioClientInstance = twilio(accountSid, authToken);
  }

  return twilioClientInstance;
}

export async function sendSms(
  phone: string,
  message: string,
  options?: {
    from?: string;
  },
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const from = messagingServiceSid
      ? undefined
      : (options?.from ?? process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER);

    if (!messagingServiceSid && !from) {
      return {
        success: false,
        error: "TWILIO_PHONE_NUMBER is not configured",
      };
    }

    // Allow overriding To number via env var (like curl test commands)
    const toOverride = process.env.TWILIO_TO_NUMBER;
    let normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
    if (toOverride) {
      normalizedPhone = toOverride;
    }

    // ─── Test Mode ───────────────────────────────────────
    // During development, redirect all SMS to the owner's own number
    // so you can see what parents receive without needing to verify
    // every parent's phone number with Twilio.
    const testMode = process.env.TWILIO_TEST_MODE === "true";

    if (testMode && toOverride) {
      const originalRecipient = normalizedPhone;
      normalizedPhone = toOverride;

      message = `[TO ${originalRecipient}] ${message}`;
    }

    const messageParams: {
      to: string;
      body: string;
      messagingServiceSid?: string;
      from?: string;
    } = {
      to: normalizedPhone,
      body: message,
    };

    if (messagingServiceSid) {
      messageParams.messagingServiceSid = messagingServiceSid;
    } else if (from) {
      messageParams.from = from;
    }

    const result = await getTwilioClient().messages.create(messageParams);

    return {
      success: true,
      messageId: result.sid,
    };
  } catch (error) {
    logger.error("Failed to send SMS", { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
