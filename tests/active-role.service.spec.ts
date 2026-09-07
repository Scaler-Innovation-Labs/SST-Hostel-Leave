import { describe, expect, it } from "vitest";

import { ROLE_CONSOLES } from "@/constants/auth/role-consoles";
import { AuthorizationError } from "@/lib/errors";
import { ROLES, type Role } from "@/lib/auth/roles";
import {
  resolveActiveRole,
  validateRoleSwitch,
} from "@/services/auth/active-role.service";

describe("resolveActiveRole", () => {
  it("honours a valid requested role", () => {
    expect(
      resolveActiveRole([ROLES.STUDENT, ROLES.POC], ROLES.STUDENT)
    ).toBe(ROLES.STUDENT);
  });

  it("falls back to the most privileged role for an unknown cookie value", () => {
    expect(
      resolveActiveRole([ROLES.STUDENT, ROLES.ADMIN], "DEAN")
    ).toBe(ROLES.ADMIN);
  });

  it("falls back to the most privileged role for an unassigned cookie value", () => {
    expect(
      resolveActiveRole([ROLES.STUDENT, ROLES.POC], ROLES.ADMIN)
    ).toBe(ROLES.POC);
  });

  it("falls back to the most privileged role without a cookie", () => {
    expect(resolveActiveRole([ROLES.GUARD, ROLES.SUPER_ADMIN], null)).toBe(
      ROLES.SUPER_ADMIN
    );
  });

  it("returns null when the user has no roles", () => {
    expect(resolveActiveRole([], ROLES.STUDENT)).toBeNull();
    expect(resolveActiveRole([], null)).toBeNull();
  });
});

describe("validateRoleSwitch", () => {
  it("allows switching to an assigned role", () => {
    expect(validateRoleSwitch([ROLES.STUDENT, ROLES.POC], ROLES.POC)).toBe(
      ROLES.POC
    );
  });

  it("rejects switching to an unassigned role", () => {
    expect(() =>
      validateRoleSwitch([ROLES.STUDENT], ROLES.ADMIN)
    ).toThrow(AuthorizationError);
  });
});

describe("ROLE_CONSOLES", () => {
  it("covers every role with a label and dashboard", () => {
    for (const role of Object.values(ROLES) as Role[]) {
      const entry = ROLE_CONSOLES[role];
      expect(entry.role).toBe(role);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.dashboardHref.startsWith("/")).toBe(true);
    }
  });
});
