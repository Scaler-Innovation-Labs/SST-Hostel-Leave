import { z } from "zod";

// Invariant: every external credential has an explicit bounded domain before
// entering business logic. Tokens are 64-hex today; 256 leaves headroom for
// future formats without opening an unbounded-DoS surface.
export const scanQrSchema = z.object({
  token: z.string().trim().min(1).max(256),
  scanType: z.enum(["EXIT_SCAN", "RETURN_SCAN"]).optional(),
});

export type ScanQrDto = z.infer<typeof scanQrSchema>;

// GET /scan/preview reads ?token= from the query string — same contract as
// the POST body, minus scanType.
export const scanQrPreviewSchema = z.object({
  token: z.string().trim().min(1).max(256),
});

export type ScanQrPreviewDto = z.infer<typeof scanQrPreviewSchema>;

export default scanQrSchema;
