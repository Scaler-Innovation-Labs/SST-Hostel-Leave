import { z } from "zod";

export const ListParentsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

export type ListParents = z.infer<typeof ListParentsSchema>;
