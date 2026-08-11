// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByFilters = vi.fn();

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByFilters: (...args: any[]) => mockFindByFilters(...args),
  },
}));

import { listStudents } from "@/services/student/list-students.service";

const MOCK_RESULT = {
  items: [{ id: "S1", fullName: "Student One", rollNumber: "R1" }],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByFilters.mockResolvedValue(MOCK_RESULT);
});

describe("listStudents service", () => {
  it("returns paginated students", async () => {
    const result = await listStudents({ page: 1, limit: 20 });

    expect(result).toEqual(MOCK_RESULT);
    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
  });

  it("passes locationState filter", async () => {
    await listStudents({ page: 1, limit: 20, locationState: "IN_HOSTEL" });

    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ locationState: "IN_HOSTEL" }));
  });

  it("passes search filter", async () => {
    await listStudents({ page: 1, limit: 20, search: "test" });

    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ search: "test" }));
  });
});
