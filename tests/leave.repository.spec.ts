// @ts-nocheck
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }),
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }) }),
  },
}));

import { leaveRepository } from "@/db/repositories/leave/leave.repository";

describe("leaveRepository", () => {
  it("exists and has expected methods", () => {
    expect(leaveRepository).toBeDefined();
    expect(typeof leaveRepository.create).toBe("function");
    expect(typeof leaveRepository.findById).toBe("function");
    expect(typeof leaveRepository.findByIdForUpdate).toBe("function");
    expect(typeof leaveRepository.findOverlappingLeaves).toBe("function");
    expect(typeof leaveRepository.updateById).toBe("function");
    expect(typeof leaveRepository.updateCurrentStep).toBe("function");
  });
});
