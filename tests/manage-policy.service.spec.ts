// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDeleteById = vi.fn();
const mockAuditRecord = vi.fn();
const mockCreateVersion = vi.fn();

vi.mock("@/db/repositories/policy/policy.repository", () => ({
  policyRepository: {
    findAll: (...args: any[]) => mockFindAll(...args),
    findById: (...args: any[]) => mockFindById(...args),
    create: (...args: any[]) => mockCreate(...args),
    update: (...args: any[]) => mockUpdate(...args),
    deleteById: (...args: any[]) => mockDeleteById(...args),
  },
}));

vi.mock("@/services/policy/policy-version.service", () => ({
  policyVersionService: {
    createVersion: (...args: any[]) => mockCreateVersion(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

vi.mock("@/lib/db", () => {
  const tx = {};
  return {
    db: {
      transaction: (cb: any) => cb(tx),
    },
  };
});

import { listPolicies, getPolicyById, createPolicy, updatePolicy, deletePolicy } from "@/services/policy/manage-policy.service";
import { NotFoundError } from "@/lib/errors";

const MOCK_POLICY = { id: "P1", name: "Max Leave Days", policyType: "LIMIT", config: { type: "MAX_DAYS", maxDays: 5 } };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindAll.mockResolvedValue([MOCK_POLICY]);
  mockFindById.mockResolvedValue(MOCK_POLICY);
  mockCreate.mockResolvedValue(MOCK_POLICY);
  mockUpdate.mockResolvedValue(MOCK_POLICY);
  mockDeleteById.mockResolvedValue(undefined);
  mockAuditRecord.mockResolvedValue({});
  mockCreateVersion.mockResolvedValue({ id: "PV1", version: 1 });
});

describe("listPolicies service", () => {
  it("returns all policies", async () => {
    const result = await listPolicies();

    expect(result).toEqual([MOCK_POLICY]);
    expect(mockFindAll).toHaveBeenCalled();
  });
});

describe("getPolicyById service", () => {
  it("returns policy by id", async () => {
    const result = await getPolicyById("P1");

    expect(result).toEqual(MOCK_POLICY);
    expect(mockFindById).toHaveBeenCalledWith("P1");
  });

  it("throws NotFoundError when not found", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(getPolicyById("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("createPolicy service", () => {
  const CREATE_DTO = { name: "Max Leave Days", policyType: "LIMIT", config: { type: "MAX_DAYS", maxDays: 5 } };

  it("creates a policy and records audit", async () => {
    const result = await createPolicy(CREATE_DTO, "U1");

    expect(result).toEqual(MOCK_POLICY);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Max Leave Days", policyType: "LIMIT", leaveTypeId: null, hostelId: null }),
      expect.any(Object)
    );
    expect(mockAuditRecord).toHaveBeenCalledWith("CREATE", "POLICY", "P1", "U1", expect.any(Object), expect.any(Object));
  });

  it("passes date fields as Date objects", async () => {
    const dto = { ...CREATE_DTO, startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-06-30T00:00:00Z" };

    await createPolicy(dto, "U1");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        startsAt: new Date("2026-06-01T00:00:00Z"),
        endsAt: new Date("2026-06-30T00:00:00Z"),
      }),
      expect.any(Object)
    );
  });
});

describe("updatePolicy service", () => {
  it("updates a policy and records audit", async () => {
    const result = await updatePolicy("P1", { name: "Updated", policyType: "LIMIT", config: {} }, "U1");

    expect(result).toEqual(MOCK_POLICY);
    expect(mockFindById).toHaveBeenCalledWith("P1", expect.any(Object));
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockAuditRecord).toHaveBeenCalledWith("UPDATE", "POLICY", "P1", "U1", expect.any(Object), expect.any(Object));
  });

  it("throws NotFoundError when policy does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(updatePolicy("NONEXISTENT", { name: "Test", policyType: "LIMIT", config: {} }, "U1")).rejects.toBeInstanceOf(NotFoundError);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("deletePolicy service", () => {
  it("deletes a policy and records audit", async () => {
    await deletePolicy("P1", "U1");

    expect(mockFindById).toHaveBeenCalledWith("P1", expect.any(Object));
    expect(mockDeleteById).toHaveBeenCalledWith("P1", expect.any(Object));
    expect(mockAuditRecord).toHaveBeenCalledWith("DELETE", "POLICY", "P1", "U1", expect.any(Object), expect.any(Object));
  });

  it("throws NotFoundError when policy does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(deletePolicy("NONEXISTENT", "U1")).rejects.toBeInstanceOf(NotFoundError);
    expect(mockDeleteById).not.toHaveBeenCalled();
  });
});
