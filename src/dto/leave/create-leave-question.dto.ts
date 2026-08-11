import { z } from "zod";

export const createLeaveQuestionSchema = z.object({
  question: z.string().trim().min(1, "Question cannot be empty").max(2000, "Question too long"),
});

export type CreateLeaveQuestionDto = z.infer<typeof createLeaveQuestionSchema>;
export default createLeaveQuestionSchema;
