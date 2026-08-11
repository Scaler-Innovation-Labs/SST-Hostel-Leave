import { z } from "zod";

export const answerLeaveQuestionSchema = z.object({
  answer: z.string().trim().min(1, "Answer cannot be empty").max(5000, "Answer too long"),
});

export type AnswerLeaveQuestionDto = z.infer<typeof answerLeaveQuestionSchema>;
export default answerLeaveQuestionSchema;
