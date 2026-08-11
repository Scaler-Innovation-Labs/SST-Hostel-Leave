// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByIdWithRelations = vi.fn();

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByIdWithRelations: (...args: any[]) => mockFindByIdWithRelations(...args),
  },
}));

import { getStudent } from "@/services/student/get-student.service";
import { NotFoundError } from "@/lib/errors";

const MOCK_STUDENT = {
  id: "S1",
  fullName: "Student One",
  rollNumber: "R1",
  user: { id: "U1", email: "test@example.com" },
  hostel: { id: "H1", name: "Boys Hostel" },
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByIdWithRelations.mockResolvedValue(MOCK_STUDENT);
});

describe("getStudent service", () => {
  it("returns student by id with relations", async () => {
    const result = await getStudent("S1");

    expect(result).toEqual(MOCK_STUDENT);
    expect(mockFindByIdWithRelations).toHaveBeenCalledWith("S1");
  });

  it("throws NotFoundError when student does not exist", async () => {
    mockFindByIdWithRelations.mockResolvedValue(null);

    await expect(getStudent("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
  });
});
