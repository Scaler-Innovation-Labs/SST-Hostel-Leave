// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreate = vi.fn();
const mockFindByEmail = vi.fn();
const mockFindByUserId = vi.fn();

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    create: (...args: any[]) => mockCreate(...args),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findByEmail: (...args: any[]) => mockFindByEmail(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockFindByUserId(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: vi.fn(),
  },
}));

import { bulkCreateParents } from "@/services/parent/bulk-create-parents.service";

const VALID_ROWS = [
  { studentEmail: "s1@example.com", name: "Parent One", phone: "+1234567890", relationship: "FATHER", isPrimary: "true" },
  { studentEmail: "s2@example.com", name: "Parent Two", phone: "+0987654321", relationship: "MOTHER", isPrimary: false, email: "parent@example.com" },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockCreate.mockResolvedValue({ id: "P1" });
  mockFindByEmail.mockImplementation((email: string) => ({ id: `USER_${email}` }));
  mockFindByUserId.mockImplementation((userId: string) => ({ id: `STUDENT_${userId}` }));
});

describe("bulkCreateParents service", () => {
  it("creates multiple parents and returns success results", async () => {
    const results = await bulkCreateParents(VALID_ROWS);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ row: 1, success: true });
    expect(results[1]).toEqual({ row: 2, success: true });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "STUDENT_USER_s1@example.com",
        name: "Parent One",
        isPrimary: true,
      }),
    );
  });

  it("returns error for failed rows without throwing", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Duplicate phone"));
    mockCreate.mockResolvedValueOnce({ id: "P2" });

    const results = await bulkCreateParents(VALID_ROWS);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ row: 1, success: false, error: "Duplicate phone" });
    expect(results[1]).toEqual({ row: 2, success: true });
  });

  it("returns row-level errors for unknown students", async () => {
    mockFindByEmail.mockResolvedValueOnce(null);

    const results = await bulkCreateParents(VALID_ROWS);

    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("handles empty array", async () => {
    const results = await bulkCreateParents([]);

    expect(results).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
