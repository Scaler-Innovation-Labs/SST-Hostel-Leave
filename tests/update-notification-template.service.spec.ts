// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindById = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/db/repositories/notification/notification-template.repository", () => ({
  notificationTemplateRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    update: (...args: any[]) => mockUpdate(...args),
  },
}));

import { updateNotificationTemplate } from "@/services/notification/update-notification-template.service";
import { NotFoundError } from "@/lib/errors";

const EXISTING = {
  id: "T1",
  code: "LEAVE_APPROVED",
  eventKey: "LEAVE_APPROVED",
  channel: "EMAIL",
  subject: null,
  templateBody: "Your leave {{leaveId}} has been approved.",
  isActive: true,
  metadata: null,
};

const MOCK_UPDATED = { ...EXISTING, templateBody: "Updated body" };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue(EXISTING);
  mockUpdate.mockResolvedValue(MOCK_UPDATED);
});

describe("updateNotificationTemplate service", () => {
  it("updates a notification template", async () => {
    const result = await updateNotificationTemplate("T1", { templateBody: "Updated body" });

    expect(result).toEqual(MOCK_UPDATED);
    expect(mockUpdate).toHaveBeenCalledWith("T1", expect.objectContaining({ templateBody: "Updated body" }));
  });

  it("throws NotFoundError when template does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(updateNotificationTemplate("NONEXISTENT", { templateBody: "test" })).rejects.toBeInstanceOf(NotFoundError);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("preserves existing values when not provided", async () => {
    await updateNotificationTemplate("T1", { isActive: false });

    expect(mockUpdate).toHaveBeenCalledWith("T1", expect.objectContaining({
      code: "LEAVE_APPROVED",
      eventKey: "LEAVE_APPROVED",
      channel: "EMAIL",
      templateBody: "Your leave {{leaveId}} has been approved.",
      isActive: false,
    }));
  });

  it("clears optional fields when explicitly set to null", async () => {
    await updateNotificationTemplate("T1", { subject: null });

    expect(mockUpdate).toHaveBeenCalledWith("T1", expect.objectContaining({ subject: null }));
  });
});
