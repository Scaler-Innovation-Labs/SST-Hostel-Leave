import { z } from "zod";

export const recordMovementSchema = z.object({
  studentId: z.string().uuid(),
  leaveRequestId: z.string().uuid().optional(),
  qrPassId: z.string().uuid().optional(),
  fromState: z.string().min(1),
  toState: z.string().min(1),
  eventType: z.string().min(1),
  movementMethod: z.string().min(1),
  isManualOverride: z.boolean().optional(),
  overrideReason: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RecordMovementDto = z.infer<typeof recordMovementSchema>;

export default recordMovementSchema;
