import { Resend } from "resend";

let resendInstance: Resend | null = null;

function getResendClient(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Resend is not configured. Set RESEND_API_KEY.",
      );
    }

    resendInstance = new Resend(apiKey);
  }

  return resendInstance;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  options?: {
    from?: string;
    cc?: string[];
    replyTo?: string;
  },
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const from =
      options?.from ??
      process.env.RESEND_FROM_EMAIL ??
      "SST Hostel <noreply@sst.hostel>";

    const { data, error } = await getResendClient().emails.send({
      from,
      to: [to],
      cc: options?.cc,
      replyTo: options?.replyTo ? [options.replyTo] : undefined,
      subject,
      text: body,
      html: body.replace(/\n/g, "<br/>"),
    });

    if (error) {
      console.error("[RESEND] Failed to send email:", error);
      return {
        success: false,
        error: error.message ?? "Resend API error",
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error("[RESEND] Failed to send email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
