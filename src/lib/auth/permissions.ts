import {
  Role,
  ROLES,
} from "./roles";

export function isAdmin(role: Role) {
  return (
    role === ROLES.ADMIN ||
    role === ROLES.SUPER_ADMIN
  );
}

export function isStudent(role: Role) {
  return role === ROLES.STUDENT;
}

export function isPOC(role: Role) {
  return role === ROLES.POC;
}