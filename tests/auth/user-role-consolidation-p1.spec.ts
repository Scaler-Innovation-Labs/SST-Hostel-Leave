import { describe, expect, it, vi } from "vitest";

import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";

function createMockDb(rows: Array<{ roleCode: string; scopeType: string | null; scopeId: string | null }>) {
  let queryCount = 0;

  const mockDb = {
    getQueryCount: () => queryCount,
    resetCount: () => {
      queryCount = 0;
    },
    select: vi.fn(() => {
      queryCount++;
      return {
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => rows),
          })),
        })),
      };
    }),
  };

  return mockDb;
}

describe("P1 — Authentication Query Consolidation", () => {
  describe("Measurement: Database query count reduction", () => {
    it("executes exactly 1 database query to resolve both role codes and scopes", async () => {
      const mockDb = createMockDb([
        { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" },
        { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H2" },
      ]);

      const result = await userRoleRepository.findRolesAndScopesByUserId("U1", mockDb as any);

      // Demonstrates single database round trip
      expect(mockDb.getQueryCount()).toBe(1);
      expect(result.roleCodes).toEqual(["ADMIN"]);
      expect(result.roleScopes).toHaveLength(2);
    });

    it("convenience wrappers derive from consolidated result", async () => {
      const mockDb = createMockDb([
        { roleCode: "POC", scopeType: "HOSTEL", scopeId: "H1" },
      ]);

      const roleCodes = await userRoleRepository.findRoleCodesByUserId("U2", mockDb as any);
      expect(mockDb.getQueryCount()).toBe(1);
      expect(roleCodes).toEqual(["POC"]);

      mockDb.resetCount();
      const roleScopes = await userRoleRepository.findRoleScopesByUserId("U2", mockDb as any);
      expect(mockDb.getQueryCount()).toBe(1);
      expect(roleScopes).toEqual([{ roleCode: "POC", scopeType: "HOSTEL", scopeId: "H1" }]);
    });
  });

  describe("Semantic Equivalence & Role Behavior", () => {
    it("handles STUDENT with zero scopes (unrestricted access)", async () => {
      const mockDb = createMockDb([
        { roleCode: "STUDENT", scopeType: null, scopeId: null },
      ]);

      const { roleCodes, roleScopes } = await userRoleRepository.findRolesAndScopesByUserId(
        "STUDENT_1",
        mockDb as any
      );

      expect(roleCodes).toEqual(["STUDENT"]);
      expect(roleScopes).toEqual([
        { roleCode: "STUDENT", scopeType: null, scopeId: null },
      ]);
    });

    it("handles SUPER_ADMIN with unrestricted access", async () => {
      const mockDb = createMockDb([
        { roleCode: "SUPER_ADMIN", scopeType: null, scopeId: null },
      ]);

      const { roleCodes, roleScopes } = await userRoleRepository.findRolesAndScopesByUserId(
        "SUPER_1",
        mockDb as any
      );

      expect(roleCodes).toEqual(["SUPER_ADMIN"]);
      expect(roleScopes).toEqual([
        { roleCode: "SUPER_ADMIN", scopeType: null, scopeId: null },
      ]);
    });

    it("handles scoped staff with multiple hostel scopes without duplicating roleCodes", async () => {
      const mockDb = createMockDb([
        { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "HOSTEL_A" },
        { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "HOSTEL_B" },
      ]);

      const { roleCodes, roleScopes } = await userRoleRepository.findRolesAndScopesByUserId(
        "ADMIN_1",
        mockDb as any
      );

      // Duplicate role codes from multiple scope rows MUST be deduplicated
      expect(roleCodes).toEqual(["ADMIN"]);
      expect(roleCodes).toHaveLength(1);

      // Scopes must retain both assignments
      expect(roleScopes).toEqual([
        { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "HOSTEL_A" },
        { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "HOSTEL_B" },
      ]);
    });

    it("handles multi-role users with mixed scoping", async () => {
      const mockDb = createMockDb([
        { roleCode: "ADMIN", scopeType: null, scopeId: null },
        { roleCode: "POC", scopeType: "HOSTEL", scopeId: "HOSTEL_C" },
      ]);

      const { roleCodes, roleScopes } = await userRoleRepository.findRolesAndScopesByUserId(
        "MULTI_1",
        mockDb as any
      );

      expect(roleCodes).toEqual(["ADMIN", "POC"]);
      expect(roleScopes).toEqual([
        { roleCode: "ADMIN", scopeType: null, scopeId: null },
        { roleCode: "POC", scopeType: "HOSTEL", scopeId: "HOSTEL_C" },
      ]);
    });

    it("handles users with zero assigned roles", async () => {
      const mockDb = createMockDb([]);

      const { roleCodes, roleScopes } = await userRoleRepository.findRolesAndScopesByUserId(
        "NO_ROLES",
        mockDb as any
      );

      expect(roleCodes).toEqual([]);
      expect(roleScopes).toEqual([]);
    });

    it("handles GUARD with null scope", async () => {
      const mockDb = createMockDb([
        { roleCode: "GUARD", scopeType: null, scopeId: null },
      ]);

      const { roleCodes, roleScopes } = await userRoleRepository.findRolesAndScopesByUserId(
        "GUARD_1",
        mockDb as any
      );

      expect(roleCodes).toEqual(["GUARD"]);
      expect(roleScopes).toEqual([
        { roleCode: "GUARD", scopeType: null, scopeId: null },
      ]);
    });
  });
});
