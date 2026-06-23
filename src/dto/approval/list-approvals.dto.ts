import { z } from "zod";

export const listApprovalsSchema = z.object({
  status: z.string().optional(),
  leaveRequestId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListApprovalsQuery = z.infer<typeof listApprovalsSchema>;

export default listApprovalsSchema;
