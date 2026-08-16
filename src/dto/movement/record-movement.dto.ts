import { z } from "zod";

import { MOVEMENT_EVENTS } from "@/constants/movement/movement-event";
import { MOVEMENT_METHODS } from "@/constants/movement/movement-method";
import { MOVEMENT_STATES } from "@/constants/movement/movement-state";

export const recordMovementSchema = z.object({
  studentId: z.string().uuid(),
  leaveRequestId: z.string().uuid().optional(),
  qrPassId: z.string().uuid().optional(),
  fromState: z.enum(MOVEMENT_STATES),
  toState: z.enum(MOVEMENT_STATES),
  eventType: z.enum(MOVEMENT_EVENTS),
  movementMethod: z.enum(MOVEMENT_METHODS),
  isManualOverride: z.boolean().optional(),
  overrideReason: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RecordMovementDto = z.infer<typeof recordMovementSchema>;

export default recordMovementSchema;
