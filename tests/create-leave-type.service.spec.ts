// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByCode = vi.fn();
const mockFindAllIncludingInactive = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findByCode: (...args: any[]) => mockFindByCode(...args),
    findAllIncludingInactive: (...args: any[]) => mockFindAllIncludingInactive(...args),
    create: (...args: any[]) => mockCreate(...args),
  },
}));

import { createLeaveType } from "@/services/leave/create-leave-type.service";
import { ConflictError } from "@/lib/errors";

const VALID_DTO = {
  code: "HOME_PASS",
  name: "Home Pass",
  category: "REGULAR",
  workflowMode: "SINGLE",
  qrMode: "EXIT_ONLY",
  allowExtensions: true,
  isActive: true,
  useGlobalNotificationRules: true,
};

const MOCK_CREATED = { id: "LT1", ...VALID_DTO, deletedAt: null };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByCode.mockResolvedValue(null);
  mockFindAllIncludingInactive.mockResolvedValue([]);
  mockCreate.mockResolvedValue(MOCK_CREATED);
});

describe("createLeaveType service", () => {
  it("creates a leave type successfully", async () => {
    const result = await createLeaveType(VALID_DTO);

    expect(result).toEqual(MOCK_CREATED);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "HOME_PASS",
        name: "Home Pass",
        isActive: true,
        deletedAt: null,
      })
    );
  });

  it("throws ConflictError when code already exists", async () => {
    mockFindByCode.mockResolvedValue({ id: "EXISTING", code: "HOME_PASS" });

    await expect(createLeaveType(VALID_DTO)).rejects.toBeInstanceOf(ConflictError);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("passes optional fields when provided", async () => {
    const dto = {
      ...VALID_DTO,
      description: "Weekend home visit",
      maxExtensionCount: 3,
      defaultWorkflowId: "WF1",
      requiredDocuments: ["DOCTOR_NOTE"],
      formSchema: { fields: [] },
      notificationConfig: { channels: ["EMAIL"] },
      uiConfig: { color: "blue" },
      policyConfig: { maxDays: 5 },
      metadata: { version: 1 },
    };

    await createLeaveType(dto);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Weekend home visit",
        maxExtensionCount: 3,
        defaultWorkflowId: "WF1",
        requiredDocuments: ["DOCTOR_NOTE"],
        formSchema: { fields: [] },
        notificationConfig: { channels: ["EMAIL"] },
        uiConfig: { color: "blue" },
        policyConfig: { maxDays: 5 },
        metadata: { version: 1 },
      })
    );
  });

  it("sets optional fields to null when not provided", async () => {
    await createLeaveType(VALID_DTO);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        description: null,
        defaultWorkflowId: null,
        maxExtensionCount: null,
        requiredDocuments: null,
        notificationConfig: null,
        uiConfig: { color: expect.any(String) },
        policyConfig: null,
        metadata: null,
      })
    );
  });

  it("reuses only the UI config when a color is provided", async () => {
    mockFindAllIncludingInactive.mockResolvedValue([{ id: "A" }, { id: "B" }]);

    await createLeaveType({ ...VALID_DTO, uiConfig: { color: "#123456", isSpecial: true } });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        uiConfig: { color: "#123456", isSpecial: true },
      })
    );
  });
});
