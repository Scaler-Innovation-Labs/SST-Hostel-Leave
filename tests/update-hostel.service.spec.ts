// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

const mockFindById = vi.fn();
const mockUpdateById = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/db/repositories/hostel/hostel.repository", () => ({
  hostelRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

import { updateHostel } from "@/services/hostel/update-hostel.service";
import { NotFoundError } from "@/lib/errors";

const VALID_INPUT = { code: "BH1", name: "Updated Boys Hostel", type: "BOYS" };
const MOCK_HOSTEL = { id: "H1", ...VALID_INPUT };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue({ id: "H1", code: "BH1", name: "Boys Hostel", type: "BOYS" });
  mockUpdateById.mockResolvedValue(MOCK_HOSTEL);
  mockAuditRecord.mockResolvedValue({});
});

describe("updateHostel service", () => {
  it("updates a hostel and records audit", async () => {
    const result = await updateHostel("H1", VALID_INPUT, { id: "U1" });

    expect(result).toEqual(MOCK_HOSTEL);
    expect(mockFindById).toHaveBeenCalledWith("H1", expect.any(Object));
    expect(mockUpdateById).toHaveBeenCalledWith("H1", VALID_INPUT, expect.any(Object));
    expect(mockAuditRecord).toHaveBeenCalledWith("UPDATE", "HOSTEL", "H1", "U1", expect.any(Object), expect.any(Object));
  });

  it("throws NotFoundError when hostel does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(updateHostel("NONEXISTENT", VALID_INPUT, { id: "U1" })).rejects.toBeInstanceOf(NotFoundError);
    expect(mockUpdateById).not.toHaveBeenCalled();
  });

  it("updates slack group ids when provided", async () => {
    const input = { ...VALID_INPUT, slackAdminGroupId: "SADM-TEAM" };

    await updateHostel("H1", input, { id: "U1" });

    expect(mockUpdateById).toHaveBeenCalledWith(
      "H1",
      expect.objectContaining({ slackAdminGroupId: "SADM-TEAM" }),
      expect.any(Object)
    );
  });

  it("clears slack group ids when blanked", async () => {
    mockFindById.mockResolvedValue({
      id: "H1",
      code: "BH1",
      name: "Boys Hostel",
      type: "BOYS",
      slackAdminGroupId: "SADM-TEAM",
    });

    await updateHostel("H1", { ...VALID_INPUT, slackAdminGroupId: null }, { id: "U1" });

    expect(mockUpdateById).toHaveBeenCalledWith("H1", expect.objectContaining({ slackAdminGroupId: null }), expect.any(Object));
  });
});
