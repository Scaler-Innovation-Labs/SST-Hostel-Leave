import { z } from "zod";

import { ROLES } from "@/lib/auth/roles";

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().or(z.literal("")).optional(),
  phone: z.string().min(10).max(15).optional().or(z.literal("")).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  hostelId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  roleCodes: z.array(z.enum([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.POC, ROLES.STUDENT, ROLES.GUARD])).optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export default updateUserSchema;
