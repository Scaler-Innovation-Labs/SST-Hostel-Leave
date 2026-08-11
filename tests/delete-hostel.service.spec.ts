// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

const mockFindById = vi.fn();
const mockFindAll = vi.fn();
const mockDeleteById = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/db/repositories/hostel/hostel.repository", () => ({
  hostelRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    findAll: (...args: any[]) => mockFindAll(...args),
    deleteById: (...args: any[]) => mockDeleteById(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

import { deleteHostel } from "@/services/hostel/delete-hostel.service";
import { getHostelById } from "@/services/hostel/get-hostel.service";
import { listHostels } from "@/services/hostel/list-hostels.service";
import { NotFoundError } from "@/lib/errors";

const MOCK_HOSTEL = { id: "H1", code: "BH1", name: "Boys Hostel", type: "BOYS" };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue(MOCK_HOSTEL);
  mockFindAll.mockResolvedValue([MOCK_HOSTEL]);
  mockDeleteById.mockResolvedValue(undefined);
  mockAuditRecord.mockResolvedValue({});
});

describe("deleteHostel service", () => {
  it("deletes a hostel and records audit", async () => {
    await deleteHostel("H1", { id: "U1" });

    expect(mockFindById).toHaveBeenCalledWith("H1", expect.any(Object));
    expect(mockDeleteById).toHaveBeenCalledWith("H1", expect.any(Object));
    expect(mockAuditRecord).toHaveBeenCalledWith("DELETE", "HOSTEL", "H1", "U1", expect.any(Object), expect.any(Object));
  });

  it("throws NotFoundError when hostel does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(deleteHostel("NONEXISTENT", { id: "U1" })).rejects.toBeInstanceOf(NotFoundError);
    expect(mockDeleteById).not.toHaveBeenCalled();
  });
});

describe("getHostelById service", () => {
  it("returns hostel by id", async () => {
    const result = await getHostelById("H1");

    expect(result).toEqual(MOCK_HOSTEL);
    expect(mockFindById).toHaveBeenCalledWith("H1");
  });

  it("returns null when not found", async () => {
    mockFindById.mockResolvedValue(null);

    const result = await getHostelById("NONEXISTENT");
    expect(result).toBeNull();
  });
});

describe("listHostels service", () => {
  it("returns all hostels", async () => {
    const result = await listHostels();

    expect(result).toEqual([MOCK_HOSTEL]);
    expect(mockFindAll).toHaveBeenCalled();
  });
});
