import type { Role } from "./roles";

export type RoleScope = {
  roleCode: string;
  scopeType: string | null;
  scopeId: string | null;
};

export type CurrentUser = {
  id: string;
  clerkId: string;
  email: string | null;
  roles: Role[];
  /**
   * Scoped role assignments. A role without any scoped rows (or with a
   * null-scope row) means unrestricted access for that role.
   */
  roleScopes?: RoleScope[];
};