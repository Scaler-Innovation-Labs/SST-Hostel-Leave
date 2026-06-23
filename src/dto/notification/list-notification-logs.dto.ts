import { z } from "zod";

export const listNotificationLogsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  eventType: z.string().optional(),
  channel: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type ListNotificationLogsQuery = z.infer<typeof listNotificationLogsSchema>;
