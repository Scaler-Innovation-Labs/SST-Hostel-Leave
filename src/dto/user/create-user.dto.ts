import { z } from "zod";

import { ROLES } from "@/lib/auth/roles";

export const userRoleScopeSchema = z.object({
  roleCode: z.enum([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.POC, ROLES.STUDENT, ROLES.GUARD]),
  /** Hostel ids the role is restricted to. Empty = unrestricted (ALL). */
  hostelIds: z.array(z.string().uuid()),
});

export type UserRoleScopeAssignment = z.infer<typeof userRoleScopeSchema>;

export const createUserSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(10).max(15).optional().or(z.literal("")),
  slackId: z.string().trim().max(64).optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  hostelId: z.string().uuid().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  roleCodes: z.array(z.enum([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.POC, ROLES.STUDENT, ROLES.GUARD])).min(1, "At least one role is required"),
  roleScopes: z.array(userRoleScopeSchema).optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;

export default createUserSchema;
