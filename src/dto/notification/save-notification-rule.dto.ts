import { z } from "zod";

import { NOTIFICATION_CHANNELS } from "@/constants/notification/notification-channel";
import { NOTIFICATION_EVENTS } from "@/constants/notification/notification-event";
import { NOTIFICATION_RECIPIENT_TYPES } from "@/constants/notification/notification-recipient-type";

export const saveNotificationRuleSchema = z.object({
  eventType: z.enum(
    NOTIFICATION_EVENTS as unknown as [string, ...string[]]
  ),
  templateId: z.string().uuid(),
  enabled: z.boolean().default(true),
  recipientTypes: z
    .array(
      z.enum(
        NOTIFICATION_RECIPIENT_TYPES as unknown as [string, ...string[]]
      )
    )
    .min(1),
  channels: z
    .array(
      z.enum(
        NOTIFICATION_CHANNELS as unknown as [string, ...string[]]
      )
    )
    .min(1),
  customRecipients: z
    .array(
      z.object({
        type: z.enum(["EMAIL", "PHONE"]),
        value: z.string().min(1).max(500),
      })
    )
    .optional()
    .default([]),
});

export type SaveNotificationRuleDto = z.infer<
  typeof saveNotificationRuleSchema
>;

export default saveNotificationRuleSchema;
