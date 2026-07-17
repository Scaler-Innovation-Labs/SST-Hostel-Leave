import { beforeEach, describe, expect, it, vi } from "vitest";

const { findActiveByLeaveTypeId, findOverlapping } = vi.hoisted(() => ({
  findActiveByLeaveTypeId: vi.fn(),
  findOverlapping: vi.fn(),
}));

vi.mock("@/db/repositories/policy/policy.repository", () => ({
  policyRepository: { findActiveByLeaveTypeId },
}));
vi.mock("@/db/repositories/policy/operational-period.repository", () => ({
  operationalPeriodRepository: { findOverlapping },
}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { policyEngine } from "@/services/policy/policy-engine";

const context = {
  leaveType: { id: "LT1", code: "HOME_PASS", defaultWorkflowId: "WF1", maxExtensionCount: 2, allowExtensions: true },
  leaveDurationDays: 8,
  hostelId: "11111111-1111-4111-8111-111111111111",
};

describe("policyEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findActiveByLeaveTypeId.mockResolvedValue([]);
    findOverlapping.mockResolvedValue([]);
  });

  it("returns hard policy restrictions", async () => {
    findActiveByLeaveTypeId.mockResolvedValue([{ name: "Max leave", policyType: "LIMIT", config: { type: "MAX_DAYS", maxDays: 7 } }]);
    const result = await policyEngine.evaluate(context);
    expect(result.allowed).toBe(false);
    expect(result.restrictions).toEqual(["Max leave: Max 7 days allowed"]);
  });

  it("records parent approval as a requirement instead of blocking", async () => {
    findActiveByLeaveTypeId.mockResolvedValue([{ name: "Parent gate", policyType: "ELIGIBILITY", config: { type: "PARENT_APPROVAL_REQUIRED" } }]);
    const result = await policyEngine.evaluate(context);
    expect(result.allowed).toBe(true);
    expect(result.requirements).toEqual(["Parent gate: Parent approval required"]);
  });

  describe("department / batch year scoping", () => {
    it("applies policy when student matches department", async () => {
      const deptId = "11111111-1111-4111-8111-111111111111";
      findActiveByLeaveTypeId.mockResolvedValue([{ name: "Dept rule", policyType: "LIMIT", config: { type: "MAX_DAYS", maxDays: 3 }, departmentId: deptId, batchYear: null }]);
      const result = await policyEngine.evaluate({ ...context, leaveDurationDays: 5, studentDepartmentId: deptId });
      expect(result.allowed).toBe(false);
      expect(result.restrictions).toEqual(["Dept rule: Max 3 days allowed"]);
    });

    it("does not apply department-scoped policy when student is in different department", async () => {
      // Repository filters out the non-matching policy — returns empty
      findActiveByLeaveTypeId.mockResolvedValue([]);
      const result = await policyEngine.evaluate({ ...context, leaveDurationDays: 5, studentDepartmentId: "11111111-1111-4111-8111-111111111111" });
      expect(result.allowed).toBe(true);
      expect(result.restrictions).toEqual([]);
    });

    it("applies policy when student matches batch year", async () => {
      findActiveByLeaveTypeId.mockResolvedValue([{ name: "Batch rule", policyType: "LIMIT", config: { type: "MAX_DAYS", maxDays: 4 }, departmentId: null, batchYear: 2024 }]);
      const result = await policyEngine.evaluate({ ...context, leaveDurationDays: 6, studentBatchYear: 2024 });
      expect(result.allowed).toBe(false);
      expect(result.restrictions).toEqual(["Batch rule: Max 4 days allowed"]);
    });

    it("does not apply batch-scoped policy when student is in different batch", async () => {
      // Repository filters out the non-matching policy — returns empty
      findActiveByLeaveTypeId.mockResolvedValue([]);
      const result = await policyEngine.evaluate({ ...context, leaveDurationDays: 6, studentBatchYear: 2025 });
      expect(result.allowed).toBe(true);
      expect(result.restrictions).toEqual([]);
    });

    it("applies unscoped policy to any department and batch", async () => {
      findActiveByLeaveTypeId.mockResolvedValue([{ name: "Global rule", policyType: "LIMIT", config: { type: "MAX_DAYS", maxDays: 5 }, departmentId: null, batchYear: null }]);
      const result = await policyEngine.evaluate({ ...context, leaveDurationDays: 7, studentDepartmentId: "11111111-1111-4111-8111-111111111111", studentBatchYear: 2024 });
      expect(result.allowed).toBe(false);
      expect(result.restrictions).toEqual(["Global rule: Max 5 days allowed"]);
    });

    it("matches policy when student has no department and policy has no department filter", async () => {
      findActiveByLeaveTypeId.mockResolvedValue([{ name: "No dept", policyType: "LIMIT", config: { type: "MAX_DAYS", maxDays: 3 }, departmentId: null, batchYear: null }]);
      const result = await policyEngine.evaluate({ ...context, leaveDurationDays: 4, studentDepartmentId: null, studentBatchYear: null });
      expect(result.allowed).toBe(false);
      expect(result.restrictions).toEqual(["No dept: Max 3 days allowed"]);
    });
  });
});
