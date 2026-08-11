// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByIdWithRelations = vi.fn();
const mockFindByUserId = vi.fn();

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByIdWithRelations: (...args: any[]) => mockFindByIdWithRelations(...args),
    findByUserId: (...args: any[]) => mockFindByUserId(...args),
  },
}));

import {
  canAccessLeave,
  getScopedHostelIds,
  hasUnrestrictedRoleAccess,
} from "@/services/shared/authorization.service";

const adminNoScope = {
  id: "U1",
  clerkId: "C1",
  email: null,
  roles: ["ADMIN"],
};

const adminHostelA = {
  ...adminNoScope,
  roleScopes: [{ roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" }],
};

const superAdmin = {
  id: "U2",
  clerkId: "C2",
  email: null,
  roles: ["SUPER_ADMIN"],
};

const student = {
  id: "U3",
  clerkId: "C3",
  email: null,
  roles: ["STUDENT"],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getScopedHostelIds", () => {
  it("returns hostel ids for HOSTEL-scoped roles", () => {
    expect(
      getScopedHostelIds({
        ...adminHostelA,
        roleScopes: [
          { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" },
          { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H2" },
        ],
      })
    ).toEqual(["H1", "H2"]);
  });

  it("returns empty array when there are no scopes", () => {
    expect(getScopedHostelIds(adminNoScope)).toEqual([]);
    expect(getScopedHostelIds({ ...adminHostelA, roleScopes: undefined })).toEqual([]);
  });

  it("ignores non-HOSTEL scopes", () => {
    expect(
      getScopedHostelIds({
        ...adminNoScope,
        roleScopes: [{ roleCode: "ADMIN", scopeType: "DEPARTMENT", scopeId: "D1" }],
      })
    ).toEqual([]);
  });
});

describe("hasUnrestrictedRoleAccess", () => {
  it("returns true for super admin", () => {
    expect(hasUnrestrictedRoleAccess(superAdmin, "ADMIN")).toBe(true);
  });

  it("returns true when the role has no scoped assignments", () => {
    expect(hasUnrestrictedRoleAccess(adminNoScope, "ADMIN")).toBe(true);
  });

  it("returns true when the only rows are null-scope (pre-scope format)", () => {
    const adminWithNullScopeRow = {
      ...adminNoScope,
      roleScopes: [{ roleCode: "ADMIN", scopeType: null, scopeId: null }],
    };
    expect(hasUnrestrictedRoleAccess(adminWithNullScopeRow, "ADMIN")).toBe(true);
  });

  it("returns false when the role has scoped assignments", () => {
    expect(hasUnrestrictedRoleAccess(adminHostelA, "ADMIN")).toBe(false);
  });

  it("returns false when the user does not hold the role", () => {
    expect(hasUnrestrictedRoleAccess(adminHostelA, "POC")).toBe(false);
  });
});

describe("canAccessLeave", () => {
  it("allows unrestricted admin", async () => {
    expect(await canAccessLeave(adminNoScope, { studentId: "S1" })).toBe(true);
  });

  it("allows admin whose only role rows are null-scope", async () => {
    const adminWithNullScopeRow = {
      ...adminNoScope,
      roleScopes: [{ roleCode: "ADMIN", scopeType: null, scopeId: null }],
    };
    expect(await canAccessLeave(adminWithNullScopeRow, { studentId: "S1" })).toBe(true);
  });

  it("allows scoped admin when the student belongs to a scoped hostel", async () => {
    mockFindByIdWithRelations.mockResolvedValue({
      student: { id: "S1" },
      user: { hostelId: "H1" },
    });

    expect(await canAccessLeave(adminHostelA, { studentId: "S1" })).toBe(true);
  });

  it("denies scoped admin when the student belongs to another hostel", async () => {
    mockFindByIdWithRelations.mockResolvedValue({
      student: { id: "S2" },
      user: { hostelId: "H9" },
    });

    expect(await canAccessLeave(adminHostelA, { studentId: "S2" })).toBe(false);
  });

  it("denies scoped admin when the student has no hostel", async () => {
    mockFindByIdWithRelations.mockResolvedValue({
      student: { id: "S3" },
      user: null,
    });

    expect(await canAccessLeave(adminHostelA, { studentId: "S3" })).toBe(false);
  });

  it("allows students only for their own leaves", async () => {
    mockFindByUserId.mockResolvedValue({ id: "S1", userId: "U3" });
    expect(await canAccessLeave(student, { studentId: "S1" })).toBe(true);

    mockFindByUserId.mockResolvedValue({ id: "S1", userId: "U3" });
    expect(await canAccessLeave(student, { studentId: "S2" })).toBe(false);
  });
});
