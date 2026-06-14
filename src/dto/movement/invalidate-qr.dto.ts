import { z } from "zod";

export const invalidateQrSchema = z.object({
  qrPassId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type InvalidateQrDto = z.infer<typeof invalidateQrSchema>;

export default invalidateQrSchema;
