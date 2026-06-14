import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindDefinitionById = vi.fn();
const mockFindStepsByWorkflowId = vi.fn();

vi.mock("@/db/repositories/workflow/workflow.repository", () => ({
  workflowRepository: {
    findDefinitionById: (...args: any[]) => mockFindDefinitionById(...args),
    findStepsByWorkflowId: (...args: any[]) => mockFindStepsByWorkflowId(...args),
  },
}));

vi.mock("@/lib/db", () => ({ db: {} }));

import { workflowEngine } from "@/services/workflow/workflow-engine";
import { NotFoundError } from "@/lib/errors";

const MOCK_STEPS = [
  { id: "S1", stepKey: "parent", stepOrder: 1, approverRoleId: "R1" },
  { id: "S2", stepKey: "warden", stepOrder: 2, approverRoleId: "R2" },
  { id: "S3", stepKey: "admin", stepOrder: 3, approverRoleId: "R3" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFindDefinitionById.mockResolvedValue({
    id: "WF1",
    isActive: true,
    version: 1,
  });
  mockFindStepsByWorkflowId.mockResolvedValue(MOCK_STEPS);
});

describe("workflowEngine", () => {
  describe("resolve", () => {
    it("resolves a workflow definition with steps", async () => {
      const result = await workflowEngine.resolve("WF1", {} as any);

      expect(result).toEqual({
        definition: {
          id: "WF1",
          isActive: true,
          version: 1,
        },
        steps: MOCK_STEPS,
      });
      expect(mockFindDefinitionById).toHaveBeenCalledWith("WF1", expect.any(Object));
      expect(mockFindStepsByWorkflowId).toHaveBeenCalledWith("WF1", expect.any(Object));
    });

    it("throws NotFoundError when workflow does not exist", async () => {
      mockFindDefinitionById.mockResolvedValue(null);

      await expect(
        workflowEngine.resolve("NONEXISTENT", {} as any)
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError when workflow is inactive", async () => {
      mockFindDefinitionById.mockResolvedValue({
        id: "WF1",
        isActive: false,
        version: 1,
      });

      await expect(
        workflowEngine.resolve("WF1", {} as any)
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("getFirstStep", () => {
    it("returns the step with the lowest stepOrder", () => {
      const steps = [
        { id: "S2", stepKey: "warden", stepOrder: 2, approverRoleId: "R2" },
        { id: "S1", stepKey: "parent", stepOrder: 1, approverRoleId: "R1" },
        { id: "S3", stepKey: "admin", stepOrder: 3, approverRoleId: "R3" },
      ];

      const result = workflowEngine.getFirstStep(steps);

      expect(result).toEqual(
        expect.objectContaining({ stepKey: "parent", stepOrder: 1 })
      );
    });

    it("returns null for empty steps array", () => {
      expect(workflowEngine.getFirstStep([])).toBeNull();
    });

    it("returns the only step when there is one", () => {
      const steps = [{ id: "S1", stepKey: "warden", stepOrder: 1, approverRoleId: "R1" }];

      const result = workflowEngine.getFirstStep(steps);

      expect(result).toEqual(expect.objectContaining({ stepKey: "warden", stepOrder: 1 }));
    });
  });

  describe("getNextStep", () => {
    it("returns the next step in order", () => {
      const result = workflowEngine.getNextStep(MOCK_STEPS, 1);

      expect(result).toEqual(
        expect.objectContaining({ stepKey: "warden", stepOrder: 2 })
      );
    });

    it("returns null when current step is the last", () => {
      const result = workflowEngine.getNextStep(MOCK_STEPS, 3);

      expect(result).toBeNull();
    });

    it("returns null when there are no further steps", () => {
      const steps = [{ id: "S1", stepKey: "parent", stepOrder: 1, approverRoleId: "R1" }];

      expect(workflowEngine.getNextStep(steps, 1)).toBeNull();
    });

    it("handles non-sequential step orders", () => {
      const steps = [
        { id: "S1", stepKey: "parent", stepOrder: 10, approverRoleId: "R1" },
        { id: "S2", stepKey: "warden", stepOrder: 20, approverRoleId: "R2" },
        { id: "S3", stepKey: "admin", stepOrder: 30, approverRoleId: "R3" },
      ];

      const result = workflowEngine.getNextStep(steps, 10);

      expect(result).toEqual(
        expect.objectContaining({ stepKey: "warden", stepOrder: 20 })
      );
    });

    it("handles unordered steps list", () => {
      const steps = [
        { id: "S3", stepKey: "admin", stepOrder: 3, approverRoleId: "R3" },
        { id: "S1", stepKey: "parent", stepOrder: 1, approverRoleId: "R1" },
      ];

      const result = workflowEngine.getNextStep(steps, 1);

      expect(result).toEqual(
        expect.objectContaining({ stepKey: "admin", stepOrder: 3 })
      );
    });
  });

  describe("isFinalStep", () => {
    it("returns true when current step is the highest order", () => {
      expect(workflowEngine.isFinalStep(MOCK_STEPS, 3)).toBe(true);
    });

    it("returns true when current step exceeds the highest order", () => {
      expect(workflowEngine.isFinalStep(MOCK_STEPS, 5)).toBe(true);
    });

    it("returns false when there are steps with higher order", () => {
      expect(workflowEngine.isFinalStep(MOCK_STEPS, 1)).toBe(false);
    });

    it("returns true when steps array is empty", () => {
      expect(workflowEngine.isFinalStep([], 1)).toBe(true);
    });
  });
});
