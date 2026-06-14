import { z } from "zod";

export const listLeavesSchema = z.object({
  studentId: z.string().uuid().optional(),
  status: z.string().optional(),
  leaveTypeId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListLeavesQuery = z.infer<typeof listLeavesSchema>;

export default listLeavesSchema;
