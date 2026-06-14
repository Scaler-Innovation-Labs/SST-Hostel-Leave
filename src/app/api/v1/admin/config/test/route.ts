import { z } from "zod";

import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { createEmailProvider } from "@/services/notification/providers/email.provider";
import { createSlackProvider } from "@/services/notification/providers/slack.provider";
import { createSmsProvider } from "@/services/notification/providers/sms.provider";

const testSchema = z.object({
  channel: z.enum(["email", "sms", "slack"]),
  recipient: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();
    requireAnyRole(currentUser, [ROLES.SUPER_ADMIN]);

    const body = await request.json();
    const dto = testSchema.parse(body);

    const timestamp = new Date().toISOString();

    switch (dto.channel) {
      case "email": {
        if (!dto.recipient) {
          return ApiResponse.error("EMAIL_REQUIRED", "Recipient email is required for email tests.");
        }
        const provider = createEmailProvider();
        const result = await provider.send({
          to: dto.recipient,
          subject: `Test Email from SST Hostel — ${timestamp}`,
          body: `This is a test email sent from the SST Hostel Leave System settings page.\n\nTimestamp: ${timestamp}\n\nIf you received this, your AWS SES configuration is working correctly.`,
        });
        return ApiResponse.success({
          channel: "email",
          success: result.success,
          messageId: result.messageId,
          error: result.error,
        });
      }

      case "sms": {
        if (!dto.recipient) {
          return ApiResponse.error("SMS_REQUIRED", "Recipient phone number is required for SMS tests.");
        }
        const provider = createSmsProvider();
        const result = await provider.send({
          to: dto.recipient,
          body: `Test SMS from SST Hostel — ${timestamp}`,
        });
        return ApiResponse.success({
          channel: "sms",
          success: result.success,
          messageId: result.messageId,
          error: result.error,
        });
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
        return ApiResponse.success({
          channel: "slack",
          success: result.success,
          messageId: result.messageId,
          error: result.error,
        });
      }

      default:
        return ApiResponse.error("INVALID_CHANNEL", "Invalid test channel.");
    }
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
