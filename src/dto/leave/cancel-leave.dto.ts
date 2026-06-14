import { z } from "zod";

export const cancelLeaveSchema = z.object({
  reason: z.string().optional(),
});

export type CancelLeaveDto = z.infer<typeof cancelLeaveSchema>;

export default cancelLeaveSchema;
