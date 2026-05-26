export const ROLES = {
  STUDENT: "student",
  ADMIN: "admin",
  POC: "poc",
  SUPER_ADMIN: "super_admin",
} as const;

export type Role =
  (typeof ROLES)[keyof typeof ROLES];