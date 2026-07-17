import { z } from "zod";
import { sortSchema } from "@/dto/shared/sort.dto";

export const listStudentsSchema = z.object({
  hostelId: z.string().uuid().optional(),
  locationState: z.string().optional(),
  search: z.string().optional(),
  sortBy: sortSchema.shape.sortBy,
  sortOrder: sortSchema.shape.sortOrder,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListStudentsQuery = z.infer<typeof listStudentsSchema>;

export default listStudentsSchema;
