import { z } from "zod";

import { NOTIFICATION_CHANNELS } from "@/constants/notification/notification-channel";
import { NOTIFICATION_EVENTS } from "@/constants/notification/notification-event";

function enumFromArray<T extends string>(values: readonly T[]): z.ZodType<T> {
  return z.string().refine(
    (val): val is T => (values as readonly string[]).includes(val),
    { message: `Must be one of: ${values.join(", ")}` },
  );
}

export const saveNotificationTemplateSchema = z.object({
  code: z.string().min(2).max(100).regex(/^[a-z0-9_]+$/),
  eventKey: enumFromArray(NOTIFICATION_EVENTS),
  channel: enumFromArray(NOTIFICATION_CHANNELS),
  subject: z.string().max(500).nullable().optional(),
  templateBody: z.string().min(1, "Template body is required").max(10000),
  isActive: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type SaveNotificationTemplateDto = z.infer<typeof saveNotificationTemplateSchema>;
