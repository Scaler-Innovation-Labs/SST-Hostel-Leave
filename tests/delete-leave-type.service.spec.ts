// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindById = vi.fn();
const mockSoftDelete = vi.fn();

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    softDelete: (...args: any[]) => mockSoftDelete(...args),
  },
}));

import { deleteLeaveType } from "@/services/leave/delete-leave-type.service";
import { NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue({ id: "LT1", code: "HOME_PASS", isActive: true });
  mockSoftDelete.mockResolvedValue({ id: "LT1" });
});

describe("deleteLeaveType service", () => {
  it("soft deletes a leave type", async () => {
    await deleteLeaveType("LT1");

    expect(mockFindById).toHaveBeenCalledWith("LT1");
    expect(mockSoftDelete).toHaveBeenCalledWith("LT1");
  });

  it("throws NotFoundError when leave type does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(deleteLeaveType("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
    expect(mockSoftDelete).not.toHaveBeenCalled();
  });
});
