import { z } from "zod";

export const createExtensionSchema = z.object({
  requestedEndAt: z.string().min(1, "New end date is required"),
  reason: z.string().min(1, "Reason is required"),
  submittedForm: z.record(z.string(), z.unknown()).optional(),
});

export type CreateExtensionDto = z.infer<typeof createExtensionSchema>;

export default createExtensionSchema;
