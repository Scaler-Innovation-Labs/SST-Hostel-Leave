import { createEmailProvider } from "@/services/notification/providers/email.provider";
import { createSlackProvider } from "@/services/notification/providers/slack.provider";
import { createSmsProvider } from "@/services/notification/providers/sms.provider";
import { ValidationError } from "@/lib/errors";

export type TestChannelInput = {
  channel: "email" | "sms" | "slack";
  recipient?: string;
};

type TestChannelResult = {
  channel: string;
  success: boolean;
  messageId?: string;
  error?: string;
};

export async function testChannel(input: TestChannelInput): Promise<TestChannelResult> {
  const timestamp = new Date().toISOString();

  switch (input.channel) {
    case "email": {
      if (!input.recipient) {
        throw new ValidationError("Recipient email is required for email tests.");
      }
      const provider = createEmailProvider();
      const result = await provider.send({
        to: input.recipient,
        subject: `Test Email from SST Hostel — ${timestamp}`,
        body: `This is a test email sent from the SST Hostel Leave System settings page.\n\nTimestamp: ${timestamp}\n\nIf you received this, your email configuration is working correctly.`,
      });
      return {
        channel: "email",
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    }

    case "sms": {
      if (!input.recipient) {
        throw new ValidationError("Recipient phone number is required for SMS tests.");
      }
      const provider = createSmsProvider();
      const result = await provider.send({
        to: input.recipient,
        body: `Test SMS from SST Hostel — ${timestamp}`,
      });
      return {
        channel: "sms",
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    }

    case "slack": {
      const provider = createSlackProvider();
      const result = await provider.send({
        to: "slack-channel",
        subject: "Test Notification",
        body: `This is a test notification from the SST Hostel Leave System.\n\nTimestamp: ${timestamp}`,
        metadata: {
          source: "Settings Page",
          timestamp,
        },
      });
      return {
        channel: "slack",
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    }

    default:
      throw new ValidationError("Invalid test channel.");
  }
}
