import { z } from "zod";

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type SortQuery = z.infer<typeof sortSchema>;
