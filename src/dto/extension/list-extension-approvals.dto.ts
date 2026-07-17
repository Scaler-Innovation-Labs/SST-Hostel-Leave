import { z } from "zod";
import { sortSchema } from "@/dto/shared/sort.dto";

export const listExtensionApprovalsSchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  sortBy: sortSchema.shape.sortBy,
  sortOrder: sortSchema.shape.sortOrder,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListExtensionApprovalsQuery = z.infer<typeof listExtensionApprovalsSchema>;

export default listExtensionApprovalsSchema;
