import { z } from "zod";

import { ROLES } from "@/lib/auth/roles";

export const setActiveRoleSchema = z.object({
  role: z.enum([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.POC, ROLES.STUDENT, ROLES.GUARD]),
});

export type SetActiveRoleDto = z.infer<typeof setActiveRoleSchema>;

export default setActiveRoleSchema;
