// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindDefinitionWithStepsById = vi.fn();

vi.mock("@/db/repositories/workflow/workflow.repository", () => ({
  workflowRepository: {
    findDefinitionWithStepsById: (...args: any[]) => mockFindDefinitionWithStepsById(...args),
  },
}));

import { getWorkflowById } from "@/services/workflow/get-workflow.service";
import { NotFoundError } from "@/lib/errors";

const MOCK_WORKFLOW = {
  id: "WF1",
  code: "LEAVE_APPROVAL",
  name: "Leave Approval",
  isActive: true,
  version: 1,
  steps: [{ stepKey: "WARDEN", stepOrder: 1, approverRoleId: "R1" }],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindDefinitionWithStepsById.mockResolvedValue(MOCK_WORKFLOW);
});

describe("getWorkflowById service", () => {
  it("returns workflow by id with steps", async () => {
    const result = await getWorkflowById("WF1");

    expect(result).toEqual(MOCK_WORKFLOW);
    expect(mockFindDefinitionWithStepsById).toHaveBeenCalledWith("WF1");
  });

  it("throws NotFoundError when workflow does not exist", async () => {
    mockFindDefinitionWithStepsById.mockResolvedValue(null);

    await expect(getWorkflowById("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
  });
});
