// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

const mockFindByCode = vi.fn();
const mockCreate = vi.fn();
const mockAuditRecord = vi.fn();

vi.mock("@/db/repositories/hostel/hostel.repository", () => ({
  hostelRepository: {
    findByCode: (...args: any[]) => mockFindByCode(...args),
    create: (...args: any[]) => mockCreate(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

import { createHostel } from "@/services/hostel/create-hostel.service";
import { ConflictError } from "@/lib/errors";

const VALID_INPUT = { code: "BH1", name: "Boys Hostel 1", type: "BOYS" };
const MOCK_HOSTEL = { id: "H1", ...VALID_INPUT };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByCode.mockResolvedValue(null);
  mockCreate.mockResolvedValue(MOCK_HOSTEL);
  mockAuditRecord.mockResolvedValue({});
});

describe("createHostel service", () => {
  it("creates a hostel and records audit", async () => {
    const result = await createHostel(VALID_INPUT, { id: "U1" });

    expect(result).toEqual(MOCK_HOSTEL);
    expect(mockCreate).toHaveBeenCalledWith(VALID_INPUT, expect.any(Object));
    expect(mockAuditRecord).toHaveBeenCalledWith("CREATE", "HOSTEL", "H1", "U1", expect.any(Object), expect.any(Object));
  });

  it("throws ConflictError when code already exists", async () => {
    mockFindByCode.mockResolvedValue({ id: "EXISTING", code: "BH1" });

    await expect(createHostel(VALID_INPUT, { id: "U1" })).rejects.toBeInstanceOf(ConflictError);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("passes slack group ids through to the repository", async () => {
    const input = { ...VALID_INPUT, slackAdminGroupId: "SADM-TEAM" };

    await createHostel(input, { id: "U1" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ slackAdminGroupId: "SADM-TEAM" }),
      expect.any(Object)
    );
  });
});
