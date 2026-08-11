// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindDefinitionById = vi.fn();
const mockDeleteDefinition = vi.fn();

vi.mock("@/db/repositories/workflow/workflow.repository", () => ({
  workflowRepository: {
    findDefinitionById: (...args: any[]) => mockFindDefinitionById(...args),
    deleteDefinition: (...args: any[]) => mockDeleteDefinition(...args),
  },
}));

vi.mock("@/lib/db", () => {
  const tx = {};
  return {
    db: {
      transaction: (cb: any) => cb(tx),
    },
  };
});

import { deleteWorkflow } from "@/services/workflow/delete-workflow.service";
import { NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockFindDefinitionById.mockResolvedValue({ id: "WF1", code: "LEAVE_APPROVAL", isActive: true });
  mockDeleteDefinition.mockResolvedValue(undefined);
});

describe("deleteWorkflow service", () => {
  it("deletes a workflow", async () => {
    await deleteWorkflow("WF1");

    expect(mockFindDefinitionById).toHaveBeenCalledWith("WF1", expect.any(Object));
    expect(mockDeleteDefinition).toHaveBeenCalledWith("WF1", expect.any(Object));
  });

  it("throws NotFoundError when workflow does not exist", async () => {
    mockFindDefinitionById.mockResolvedValue(null);

    await expect(deleteWorkflow("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
    expect(mockDeleteDefinition).not.toHaveBeenCalled();
  });
});
