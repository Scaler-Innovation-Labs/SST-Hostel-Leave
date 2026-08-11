// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindById = vi.fn();
const mockFindByCode = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    findByCode: (...args: any[]) => mockFindByCode(...args),
    update: (...args: any[]) => mockUpdate(...args),
  },
}));

import { updateLeaveType } from "@/services/leave/update-leave-type.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

const EXISTING = {
  id: "LT1",
  code: "HOME_PASS",
  name: "Home Pass",
  category: "REGULAR",
  description: null,
  workflowMode: "SINGLE",
  qrMode: "EXIT_ONLY",
  defaultWorkflowId: null,
  allowExtensions: true,
  maxExtensionCount: null,
  isActive: true,
  formSchema: null,
  requiredDocuments: null,
  notificationConfig: null,
  uiConfig: null,
  useGlobalNotificationRules: true,
  policyConfig: null,
  metadata: null,
};

const MOCK_UPDATED = { ...EXISTING, name: "Updated Home Pass" };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue(EXISTING);
  mockFindByCode.mockResolvedValue(null);
  mockUpdate.mockResolvedValue(MOCK_UPDATED);
});

describe("updateLeaveType service", () => {
  it("updates a leave type successfully", async () => {
    const result = await updateLeaveType("LT1", { name: "Updated Home Pass" });

    expect(result).toEqual(MOCK_UPDATED);
    expect(mockUpdate).toHaveBeenCalledWith("LT1", expect.objectContaining({
      name: "Updated Home Pass",
      code: "HOME_PASS",
    }));
  });

  it("throws NotFoundError when leave type does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(updateLeaveType("NONEXISTENT", { name: "Test" })).rejects.toBeInstanceOf(NotFoundError);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("throws ConflictError when new code conflicts with existing", async () => {
    mockFindByCode.mockResolvedValue({ id: "LT2", code: "MEDICAL" });

    await expect(updateLeaveType("LT1", { code: "MEDICAL" })).rejects.toBeInstanceOf(ConflictError);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows updating to same code (no conflict)", async () => {
    mockFindByCode.mockResolvedValue(EXISTING);

    await updateLeaveType("LT1", { name: "Renamed" });

    expect(mockUpdate).toHaveBeenCalled();
  });

  it("preserves existing values when not provided in dto", async () => {
    await updateLeaveType("LT1", { name: "Renamed" });

    expect(mockUpdate).toHaveBeenCalledWith("LT1", expect.objectContaining({
      code: "HOME_PASS",
      category: "REGULAR",
      workflowMode: "SINGLE",
      qrMode: "EXIT_ONLY",
      allowExtensions: true,
      isActive: true,
    }));
  });

  it("updates all provided fields", async () => {
    await updateLeaveType("LT1", {
      name: "Renamed",
      code: "NEW_CODE",
      description: "New description",
      isActive: false,
      allowExtensions: false,
    });

    expect(mockUpdate).toHaveBeenCalledWith("LT1", expect.objectContaining({
      name: "Renamed",
      code: "NEW_CODE",
      description: "New description",
      isActive: false,
      allowExtensions: false,
    }));
  });
});
