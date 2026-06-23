import type { Role } from "./roles";

export type CurrentUser = {
  id: string;
  clerkId: string;
  email: string | null;
  roles: Role[];
};