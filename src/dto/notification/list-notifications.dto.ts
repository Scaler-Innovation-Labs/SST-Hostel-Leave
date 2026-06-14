import { z } from "zod";

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export type MarkNotificationsReadDto = z.infer<typeof markNotificationsReadSchema>;
