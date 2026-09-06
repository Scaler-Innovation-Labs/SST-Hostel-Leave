// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindStudentByUserId = vi.fn();
const mockVerifyStudentOwnership = vi.fn();
const mockFindEvents = vi.fn();

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockFindStudentByUserId(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: { findById: vi.fn().mockResolvedValue(null) },
}));

vi.mock("@/db/repositories/movement/movement-event.repository", () => ({
  movementEventRepository: {
    findByFilters: (...args: any[]) => mockFindEvents(...args),
  },
}));

vi.mock("@/services/shared/authorization.service", () => ({
  verifyStudentOwnership: (...args: any[]) => mockVerifyStudentOwnership(...args),
  isStaffScopeRestricted: () => false,
  getScopedHostelIds: () => [],
}));

import { listMovements } from "@/services/movement/list-movements.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockFindEvents.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  mockVerifyStudentOwnership.mockResolvedValue(undefined);
  mockFindStudentByUserId.mockResolvedValue({ id: "S1" });
});

describe("listMovements student scoping", () => {
  it("forces the student's own id on unfiltered calls", async () => {
    await listMovements(
      { page: 1, limit: 20 },
      { id: "U1", roles: ["STUDENT"] }
    );

    expect(mockFindEvents).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "S1" })
    );
  });

  it("overrides a forged studentId with the caller's own", async () => {
    await listMovements(
      { page: 1, limit: 20, studentId: "VICTIM" },
      { id: "U1", roles: ["STUDENT"] }
    );

    expect(mockFindEvents).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "S1" })
    );
    expect(mockVerifyStudentOwnership).toHaveBeenCalledWith(
      { id: "U1", roles: ["STUDENT"] },
      "S1"
    );
  });

  it("rejects students without a profile before any query", async () => {
    mockFindStudentByUserId.mockResolvedValue(null);

    await expect(
      listMovements({ page: 1, limit: 20 }, { id: "U1", roles: ["STUDENT"] })
    ).rejects.toThrow();
    expect(mockFindEvents).not.toHaveBeenCalled();
  });

  it("leaves staff queries unforced", async () => {
    await listMovements(
      { page: 1, limit: 20 },
      { id: "A1", roles: ["ADMIN"] }
    );

    expect(mockFindStudentByUserId).not.toHaveBeenCalled();
    expect(mockFindEvents).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: undefined })
    );
  });
});
