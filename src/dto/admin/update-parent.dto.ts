import { z } from "zod";

export const updateParentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional().or(z.literal("")),
  relationship: z.string().min(1).max(100).optional(),
  isPrimary: z.boolean().optional(),
});

export type UpdateParentDto = z.infer<typeof updateParentSchema>;

export default updateParentSchema;
