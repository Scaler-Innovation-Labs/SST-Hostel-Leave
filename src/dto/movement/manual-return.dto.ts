import { z } from "zod";

export const manualReturnSchema = z.object({
  studentId: z.string().uuid(),
  leaveRequestId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
});

export type ManualReturnDto = z.infer<typeof manualReturnSchema>;

export default manualReturnSchema;
