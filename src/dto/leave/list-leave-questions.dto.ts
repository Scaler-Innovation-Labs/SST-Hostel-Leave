import { z } from "zod";

export const listLeaveQuestionsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type ListLeaveQuestionsQuery = z.infer<typeof listLeaveQuestionsSchema>;
export default listLeaveQuestionsSchema;
