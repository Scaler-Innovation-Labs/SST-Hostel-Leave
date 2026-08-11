// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindAllDefinitions = vi.fn();

vi.mock("@/db/repositories/workflow/workflow.repository", () => ({
  workflowRepository: {
    findAllDefinitions: (...args: any[]) => mockFindAllDefinitions(...args),
  },
}));

import { listWorkflows } from "@/services/workflow/list-workflows.service";

const MOCK_RESULT = {
  items: [{ id: "WF1", code: "LEAVE_APPROVAL", name: "Leave Approval", isActive: true, version: 1, steps: [] }],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindAllDefinitions.mockResolvedValue(MOCK_RESULT);
});

describe("listWorkflows service", () => {
  it("returns paginated workflows", async () => {
    const result = await listWorkflows({ page: 1, limit: 20 });

    expect(result).toEqual(MOCK_RESULT);
    expect(mockFindAllDefinitions).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
  });

  it("passes search filter", async () => {
    await listWorkflows({ page: 1, limit: 20, search: "approval" });

    expect(mockFindAllDefinitions).toHaveBeenCalledWith(expect.objectContaining({ search: "approval" }));
  });

  it("passes isActive filter", async () => {
    await listWorkflows({ page: 1, limit: 20, isActive: true });

    expect(mockFindAllDefinitions).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });
});
