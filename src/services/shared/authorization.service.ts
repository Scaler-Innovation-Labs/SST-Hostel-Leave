import { ROLE_SCOPE_TYPE } from "@/constants/auth/role-scope";
import { type Student,studentRepository } from "@/db/repositories/student/student.repository";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { AuthorizationError } from "@/lib/errors";

// ─── Role-scope helpers ───────────────────────────────────────────

/**
 * Entity ids the current user is scoped to for a given scope type
 * (e.g. hostel ids for HOSTEL scope). Empty when the user has no
 * scoped assignments of that type (i.e. unrestricted).
 */
export function getScopedEntityIds(
  currentUser: CurrentUser,
  scopeType: string
): string[] {
  return (currentUser.roleScopes ?? [])
    .filter((s) => s.scopeType === scopeType && !!s.scopeId)
    .map((s) => s.scopeId as string);
}

/** Hostel ids the current user is restricted to (empty = ALL hostels). */
export function getScopedHostelIds(currentUser: CurrentUser): string[] {
  return getScopedEntityIds(currentUser, ROLE_SCOPE_TYPE.HOSTEL);
}

/** Department ids the current user is restricted to (empty = ALL departments). */
export function getScopedDepartmentIds(currentUser: CurrentUser): string[] {
  return getScopedEntityIds(currentUser, ROLE_SCOPE_TYPE.DEPARTMENT);
}

/**
 * True when the user holds the role with unrestricted (ALL) access:
 * super-admin always, or the role has no *scoped* assignment rows.
 * Null-scope rows (the pre-scope format) mean unrestricted.
 */
export function hasUnrestrictedRoleAccess(
  currentUser: CurrentUser,
  roleCode: string
): boolean {
  if (currentUser.roles.includes(ROLES.SUPER_ADMIN)) return true;
  if (!currentUser.roles.some((r) => r === roleCode)) return false;
  const scopedForRole = (currentUser.roleScopes ?? []).filter(
    (s) => s.roleCode === roleCode && s.scopeType !== null && s.scopeId !== null
  );
  return scopedForRole.length === 0;
}

/**
 * Most-restrictive-wins: true when any staff role the user holds is
 * scoped (even if another held role is unrestricted).
 */
export function isStaffScopeRestricted(currentUser: CurrentUser): boolean {
  const isAdmin = currentUser.roles.includes(ROLES.ADMIN);
  const isPoc = currentUser.roles.includes(ROLES.POC);
  if (!isAdmin && !isPoc) return false;
  return (
    (isAdmin && !hasUnrestrictedRoleAccess(currentUser, ROLES.ADMIN)) ||
    (isPoc && !hasUnrestrictedRoleAccess(currentUser, ROLES.POC))
  );
}

/**
 * Whether the current user may access a given hostel.
 * - SUPER_ADMIN: true
 * - ADMIN/POC: true when unscoped, or the hostel is within scope
 * - Other roles: false
 */
export function hasAccessToHostel(
  currentUser: CurrentUser,
  hostelId: string
): boolean {
  if (currentUser.roles.includes(ROLES.SUPER_ADMIN)) return true;
  if (!currentUser.roles.some((r) => r === ROLES.ADMIN || r === ROLES.POC)) {
    return false;
  }
  if (!isStaffScopeRestricted(currentUser)) return true;
  return getScopedHostelIds(currentUser).includes(hostelId);
}

/**
 * Whether the current user may access a given leave request.
 * - SUPER_ADMIN / unrestricted ADMIN-POC: true
 * - HOSTEL-scoped admin/poc: true only when the student's hostel is in scope
 * - STUDENT: only their own leaves
 */
export async function canAccessLeave(
  currentUser: CurrentUser,
  leave: { studentId: string }
): Promise<boolean> {
  if (currentUser.roles.some((r) => r === ROLES.STUDENT)) {
    try {
      await verifyStudentOwnership(currentUser, leave.studentId);
      return true;
    } catch {
      return false;
    }
  }

  if (currentUser.roles.includes(ROLES.SUPER_ADMIN)) return true;

  const isAdmin = currentUser.roles.includes(ROLES.ADMIN);
  const isPoc = currentUser.roles.includes(ROLES.POC);
  if (!isAdmin && !isPoc) return false;

  if (!isStaffScopeRestricted(currentUser)) return true;

  const student = await studentRepository.findByIdWithRelations(leave.studentId);
  const studentHostelId = student?.user?.hostelId ?? null;
  if (!studentHostelId) return false;

  return getScopedHostelIds(currentUser).includes(studentHostelId);
}

/** Alias of {@link canAccessLeave} used on detail/action endpoints. */
export async function hasAccessToLeave(
  currentUser: CurrentUser,
  leave: { studentId: string }
): Promise<boolean> {
  return canAccessLeave(currentUser, leave);
}

/**
 * Whether the current user may access a given student profile.
 * - SUPER_ADMIN / unrestricted ADMIN-POC: true
 * - HOSTEL-scoped admin/poc: true only when the student's hostel is in scope
 * - STUDENT: only their own profile
 */
export async function hasAccessToStudent(
  currentUser: CurrentUser,
  studentId: string
): Promise<boolean> {
  if (currentUser.roles.some((r) => r === ROLES.STUDENT)) {
    const student = await studentRepository.findByUserId(currentUser.id);
    return student?.id === studentId;
  }

  if (currentUser.roles.includes(ROLES.SUPER_ADMIN)) return true;

  if (!currentUser.roles.some((r) => r === ROLES.ADMIN || r === ROLES.POC)) {
    return false;
  }

  if (!isStaffScopeRestricted(currentUser)) return true;

  const student = await studentRepository.findByIdWithRelations(studentId);
  const studentHostelId = student?.user?.hostelId ?? null;
  if (!studentHostelId) return false;

  return getScopedHostelIds(currentUser).includes(studentHostelId);
}

/**
 * Whether the current user may access a given movement event (tied to a student).
 */
export async function hasAccessToMovement(
  currentUser: CurrentUser,
  movement: { studentId: string }
): Promise<boolean> {
  if (currentUser.roles.some((r) => r === ROLES.STUDENT)) {
    try {
      await verifyStudentOwnership(currentUser, movement.studentId);
      return true;
    } catch {
      return false;
    }
  }
  return hasAccessToStudent(currentUser, movement.studentId);
}

/** Throws when the current user may not access the given leave request. */
export async function assertCanAccessLeave(
  currentUser: CurrentUser,
  leave: { studentId: string }
): Promise<void> {
  if (!(await canAccessLeave(currentUser, leave))) {
    throw new AuthorizationError("You do not have access to this leave");
  }
}

export async function verifyStudentOwnership(
  currentUser: CurrentUser,
  resourceStudentId: string,
): Promise<void> {
  if (currentUser.roles.some(r => r === ROLES.ADMIN || r === ROLES.POC || r === ROLES.SUPER_ADMIN)) {
    return;
  }

  const student = await studentRepository.findByUserId(currentUser.id);
  if (!student || student.id !== resourceStudentId) {
    throw new AuthorizationError("You do not have access to this resource");
  }
}

export async function requireCurrentUserStudent(currentUser: CurrentUser): Promise<Student> {
  if (currentUser.roles.some(r => r === ROLES.ADMIN || r === ROLES.POC || r === ROLES.SUPER_ADMIN)) {
    throw new AuthorizationError("Only students can perform this action");
  }

  const student = await studentRepository.findByUserId(currentUser.id);
  if (!student) {
    throw new AuthorizationError("Student profile not found");
  }

  return student;
}
