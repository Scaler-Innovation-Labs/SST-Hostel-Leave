import twilio from "twilio";

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
    const from =
      options?.from ?? process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER;

    if (!from) {
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

    if (testMode && normalizedPhone !== from) {
      const originalRecipient = normalizedPhone;
      normalizedPhone = from;

      message = `[TO ${originalRecipient}] ${message}`;
    }

    const result = await getTwilioClient().messages.create({
      to: normalizedPhone,
      from,
      body: message,
    });

    return {
      success: true,
      messageId: result.sid,
    };
  } catch (error) {
    console.error("[TWILIO] Failed to send SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
