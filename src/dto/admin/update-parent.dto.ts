import { z } from "zod";

import { optionalPhoneField } from "@/dto/shared/phone.dto";

export const updateParentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: optionalPhoneField(),
  email: z.string().email().optional().or(z.literal("")),
  relationship: z.string().min(1).max(100).optional(),
  isPrimary: z.boolean().optional(),
});

export type UpdateParentDto = z.infer<typeof updateParentSchema>;

export default updateParentSchema;
