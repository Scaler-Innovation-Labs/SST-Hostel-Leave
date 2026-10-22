// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByEntityIds = vi.fn();

vi.mock("@/db/repositories/audit/audit.repository", () => ({
  auditRepository: {
    findByEntityIds: (...args: any[]) => mockFindByEntityIds(...args),
  },
}));

import {
  checkParentOverride,
  getApprovalOverrideTypes,
} from "@/services/leave/shared-approval.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByEntityIds.mockResolvedValue([]);
});

describe("getApprovalOverrideTypes", () => {
  it("returns an empty map without querying when there are no approvals", async () => {
    const result = await getApprovalOverrideTypes([]);

    expect(result.size).toBe(0);
    expect(mockFindByEntityIds).not.toHaveBeenCalled();
  });

  it("maps override audit rows to their override types", async () => {
    mockFindByEntityIds.mockResolvedValue([
      { entityId: "A1", action: "OVERRIDE", metadata: null },
      {
        entityId: "A2",
        action: "APPROVE",
        metadata: { overrideType: "PARENT_OVERRIDE" },
      },
      { entityId: "A3", action: "APPROVE", metadata: { comments: "ok" } },
    ]);

    const result = await getApprovalOverrideTypes(["A1", "A2", "A3"]);

    expect(mockFindByEntityIds).toHaveBeenCalledWith("LEAVE_APPROVAL", [
      "A1",
      "A2",
      "A3",
    ]);
    expect(result.get("A1")).toBe("ADMIN_OVERRIDE");
    expect(result.get("A2")).toBe("PARENT_OVERRIDE");
    expect(result.has("A3")).toBe(false);
  });
});

describe("checkParentOverride", () => {
  const parentStep = {
    assignedApproverUserId: null,
    approverRoleCode: "PARENT",
    stepKey: "PARENT_APPROVAL",
    stepOrder: 1,
  };

  it("asks for confirmation while the parent decision is still pending", () => {
    const result = checkParentOverride(
      parentStep,
      {},
      { id: "U1", roles: ["ADMIN"] },
    );

    expect(result).toEqual(
      expect.objectContaining({
        isParentOverride: true,
        requiresConfirmation: true,
        decision: "PENDING",
      }),
    );
  });

  it("records a confirmed force override as a parent override", () => {
    const result = checkParentOverride(
      parentStep,
      { forceOverride: true },
      { id: "U1", roles: ["ADMIN"] },
    );

    expect(result).toEqual({ isParentOverride: true });
  });
});
