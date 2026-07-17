import { z } from "zod";
import { sortSchema } from "@/dto/shared/sort.dto";

export const listLeaveExtensionsSchema = z.object({
  sortBy: sortSchema.shape.sortBy,
  sortOrder: sortSchema.shape.sortOrder,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListLeaveExtensionsQuery = z.infer<typeof listLeaveExtensionsSchema>;

export default listLeaveExtensionsSchema;
