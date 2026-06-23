import { z } from "zod";

export const listMovementsSchema = z.object({
  studentId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  leaveRequestId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListMovementsQuery = z.infer<typeof listMovementsSchema>;

export default listMovementsSchema;
