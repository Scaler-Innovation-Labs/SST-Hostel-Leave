// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("@/db/repositories/notification/notification-template.repository", () => ({
  notificationTemplateRepository: {
    create: (...args: any[]) => mockCreate(...args),
  },
}));

import { saveNotificationTemplate } from "@/services/notification/save-notification-template.service";

const VALID_DTO = {
  code: "LEAVE_APPROVED",
  eventKey: "LEAVE_APPROVED",
  channel: "EMAIL",
  templateBody: "Your leave {{leaveId}} has been approved.",
  isActive: true,
};

const MOCK_RESULT = { id: "T1", ...VALID_DTO, subject: null, metadata: null };

beforeEach(() => {
  vi.resetAllMocks();
  mockCreate.mockResolvedValue(MOCK_RESULT);
});

describe("saveNotificationTemplate service", () => {
  it("creates a notification template", async () => {
    const result = await saveNotificationTemplate(VALID_DTO);

    expect(result).toEqual(MOCK_RESULT);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "LEAVE_APPROVED",
        eventKey: "LEAVE_APPROVED",
        channel: "EMAIL",
        templateBody: "Your leave {{leaveId}} has been approved.",
        isActive: true,
        subject: null,
        metadata: null,
      })
    );
  });

  it("passes subject and metadata when provided", async () => {
    const dto = {
      ...VALID_DTO,
      subject: "Leave Approved",
      metadata: { version: 1 },
    };

    await saveNotificationTemplate(dto);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Leave Approved",
        metadata: { version: 1 },
      })
    );
  });
});
