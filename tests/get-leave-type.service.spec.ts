// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindById = vi.fn();

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

import { getLeaveTypeById } from "@/services/leave/get-leave-type.service";
import { NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue({ id: "LT1", code: "HOME_PASS", name: "Home Pass", isActive: true });
});

describe("getLeaveTypeById service", () => {
  it("returns leave type by id", async () => {
    const result = await getLeaveTypeById("LT1");

    expect(result).toEqual({ id: "LT1", code: "HOME_PASS", name: "Home Pass", isActive: true });
    expect(mockFindById).toHaveBeenCalledWith("LT1");
  });

  it("throws NotFoundError when leave type does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(getLeaveTypeById("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
  });
});
