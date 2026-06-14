import { z } from "zod";

export const completeLeaveSchema = z.object({
  actualReturnAt: z.string().datetime().optional(),
});

export type CompleteLeaveDto = z.infer<typeof completeLeaveSchema>;

export default completeLeaveSchema;
