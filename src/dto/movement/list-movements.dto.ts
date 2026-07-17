import { z } from "zod";
import { sortSchema } from "@/dto/shared/sort.dto";

export const listMovementsSchema = z.object({
  studentId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  leaveRequestId: z.string().uuid().optional(),
  sortBy: sortSchema.shape.sortBy,
  sortOrder: sortSchema.shape.sortOrder,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListMovementsQuery = z.infer<typeof listMovementsSchema>;

export default listMovementsSchema;
