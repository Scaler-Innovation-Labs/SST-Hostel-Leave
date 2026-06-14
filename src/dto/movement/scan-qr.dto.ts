import { z } from "zod";

export const scanQrSchema = z.object({
  token: z.string().min(1),
  scanType: z.enum(["EXIT_SCAN", "RETURN_SCAN"]),
});

export type ScanQrDto = z.infer<typeof scanQrSchema>;

export default scanQrSchema;
