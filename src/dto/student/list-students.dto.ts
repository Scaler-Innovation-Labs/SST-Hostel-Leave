import { z } from "zod";

export const listStudentsSchema = z.object({
  hostelId: z.string().uuid().optional(),
  locationState: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListStudentsQuery = z.infer<typeof listStudentsSchema>;

export default listStudentsSchema;
