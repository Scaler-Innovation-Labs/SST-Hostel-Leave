import { z } from "zod";
import { sortSchema } from "@/dto/shared/sort.dto";

export const listNotificationsSchema = z.object({
  sortBy: sortSchema.shape.sortBy,
  sortOrder: sortSchema.shape.sortOrder,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export type MarkNotificationsReadDto = z.infer<typeof markNotificationsReadSchema>;
