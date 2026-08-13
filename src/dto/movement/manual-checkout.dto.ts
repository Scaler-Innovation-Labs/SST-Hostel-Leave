import { z } from "zod";

export const manualCheckoutSchema = z.object({
  studentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type ManualCheckoutDto = z.infer<typeof manualCheckoutSchema>;

export default manualCheckoutSchema;
