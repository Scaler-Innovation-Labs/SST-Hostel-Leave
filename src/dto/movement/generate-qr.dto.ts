import { z } from "zod";

export const generateQrSchema = z.object({
  leaveRequestId: z.string().uuid(),
  qrType: z.enum(["LEAVE_EXIT", "LEAVE_RETURN"]),
  regenerate: z.boolean().optional(),
});

export type GenerateQrDto = z.infer<typeof generateQrSchema>;

export default generateQrSchema;
