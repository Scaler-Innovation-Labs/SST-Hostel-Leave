import { z } from "zod";

export const listWorkflowsSchema = z.object({
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListWorkflowsQuery = z.infer<typeof listWorkflowsSchema>;

export default listWorkflowsSchema;
