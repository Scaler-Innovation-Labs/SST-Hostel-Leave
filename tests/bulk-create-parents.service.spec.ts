// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    create: (...args: any[]) => mockCreate(...args),
  },
}));

import { bulkCreateParents } from "@/services/parent/bulk-create-parents.service";

const VALID_ROWS = [
  { studentId: "S1", name: "Parent One", phone: "+1234567890", relationship: "FATHER", isPrimary: true },
  { studentId: "S2", name: "Parent Two", phone: "+0987654321", relationship: "MOTHER", isPrimary: false, email: "parent@example.com" },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockCreate.mockResolvedValue({ id: "P1" });
});

describe("bulkCreateParents service", () => {
  it("creates multiple parents and returns success results", async () => {
    const results = await bulkCreateParents(VALID_ROWS);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ row: 1, success: true });
    expect(results[1]).toEqual({ row: 2, success: true });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("returns error for failed rows without throwing", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Duplicate phone"));
    mockCreate.mockResolvedValueOnce({ id: "P2" });

    const results = await bulkCreateParents(VALID_ROWS);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ row: 1, success: false, error: "Duplicate phone" });
    expect(results[1]).toEqual({ row: 2, success: true });
  });

  it("handles empty array", async () => {
    const results = await bulkCreateParents([]);

    expect(results).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
