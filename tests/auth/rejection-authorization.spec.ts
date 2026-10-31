import { describe, expect, it } from "vitest";

import {
  canApproveApproval,
  canRejectApproval,
  requireApprovalAuthorization,
  requireRejectionAuthorization,
} from "@/lib/auth/authorization";
import { ROLES } from "@/lib/auth/roles";
import { AuthorizationError } from "@/lib/errors";

describe("rejection authorization", () => {
  const pocApproval = {
    id: "app-1",
    assignedApproverUserId: "user-poc-1",
    approverUserId: null,
    approverRoleCode: "POC",
  };

  const parentApproval = {
    id: "app-2",
    assignedApproverUserId: null,
    approverUserId: null,
    approverRoleCode: null,
  };

  const adminApproval = {
    id: "app-3",
    assignedApproverUserId: null,
    approverUserId: null,
    approverRoleCode: "ADMIN",
  };

  const adminUser = { id: "admin-1", roles: [ROLES.ADMIN] };
  const superAdminUser = { id: "super-1", roles: [ROLES.SUPER_ADMIN] };
  const assignedPocUser = { id: "user-poc-1", roles: [ROLES.POC] };
  const otherPocUser = { id: "user-poc-2", roles: [ROLES.POC] };

  describe("canApproveApproval (standard approval checks)", () => {
    it("allows assigned POC to approve their step", () => {
      expect(canApproveApproval(pocApproval, assignedPocUser)).toBe(true);
    });

    it("blocks non-assigned POC from approving assigned step", () => {
      expect(canApproveApproval(pocApproval, otherPocUser)).toBe(false);
    });

    it("blocks Admin from approving a step assigned to a specific POC without override", () => {
      expect(canApproveApproval(pocApproval, adminUser)).toBe(false);
    });
  });

  describe("canRejectApproval", () => {
    it("always allows ADMIN to reject a step assigned to a POC", () => {
      expect(canRejectApproval(pocApproval, adminUser)).toBe(true);
    });

    it("always allows SUPER_ADMIN to reject a step assigned to a POC", () => {
      expect(canRejectApproval(pocApproval, superAdminUser)).toBe(true);
    });

    it("always allows ADMIN to reject a PARENT_APPROVAL step", () => {
      expect(canRejectApproval(parentApproval, adminUser)).toBe(true);
    });

    it("always allows SUPER_ADMIN to reject a PARENT_APPROVAL step", () => {
      expect(canRejectApproval(parentApproval, superAdminUser)).toBe(true);
    });

    it("allows the assigned POC to reject their assigned step", () => {
      expect(canRejectApproval(pocApproval, assignedPocUser)).toBe(true);
    });

    it("blocks another POC from rejecting an unassigned step", () => {
      expect(canRejectApproval(pocApproval, otherPocUser)).toBe(false);
    });

    it("blocks POC from rejecting an ADMIN step", () => {
      expect(canRejectApproval(adminApproval, assignedPocUser)).toBe(false);
    });
  });

  describe("requireRejectionAuthorization", () => {
    it("does not throw for ADMIN on any step", () => {
      expect(() => requireRejectionAuthorization(pocApproval, adminUser)).not.toThrow();
      expect(() => requireRejectionAuthorization(parentApproval, adminUser)).not.toThrow();
      expect(() => requireRejectionAuthorization(adminApproval, adminUser)).not.toThrow();
    });

    it("does not throw for SUPER_ADMIN on any step", () => {
      expect(() => requireRejectionAuthorization(pocApproval, superAdminUser)).not.toThrow();
      expect(() => requireRejectionAuthorization(parentApproval, superAdminUser)).not.toThrow();
      expect(() => requireRejectionAuthorization(adminApproval, superAdminUser)).not.toThrow();
    });

    it("does not throw for assigned POC on their assigned step", () => {
      expect(() => requireRejectionAuthorization(pocApproval, assignedPocUser)).not.toThrow();
    });

    it("throws AuthorizationError for unassigned POC or insufficient role", () => {
      expect(() => requireRejectionAuthorization(pocApproval, otherPocUser)).toThrow(AuthorizationError);
      expect(() => requireRejectionAuthorization(adminApproval, assignedPocUser)).toThrow(AuthorizationError);
    });
  });
});
