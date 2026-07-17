import { z } from "zod";
import { sortSchema } from "@/dto/shared/sort.dto";

export const listUsersSchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  excludeRole: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  sortBy: sortSchema.shape.sortBy,
  sortOrder: sortSchema.shape.sortOrder,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListUsersQuery = z.infer<typeof listUsersSchema>;

export default listUsersSchema;
