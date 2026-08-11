// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockList = vi.fn();
const mockFindById = vi.fn();

vi.mock("@/db/repositories/notification/notification-template.repository", () => ({
  notificationTemplateRepository: {
    list: (...args: any[]) => mockList(...args),
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

import { listNotificationTemplates, getNotificationTemplateById } from "@/services/notification/list-notification-templates.service";
import { NotFoundError } from "@/lib/errors";

const MOCK_TEMPLATES = [
  { id: "T1", code: "LEAVE_APPROVED", eventKey: "LEAVE_APPROVED", channel: "EMAIL", templateBody: "Approved", isActive: true },
  { id: "T2", code: "LEAVE_REJECTED", eventKey: "LEAVE_REJECTED", channel: "EMAIL", templateBody: "Rejected", isActive: true },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockList.mockResolvedValue(MOCK_TEMPLATES);
  mockFindById.mockResolvedValue(MOCK_TEMPLATES[0]);
});

describe("listNotificationTemplates service", () => {
  it("returns all notification templates", async () => {
    const result = await listNotificationTemplates();

    expect(result).toEqual(MOCK_TEMPLATES);
    expect(mockList).toHaveBeenCalled();
  });
});

describe("getNotificationTemplateById service", () => {
  it("returns template by id", async () => {
    const result = await getNotificationTemplateById("T1");

    expect(result).toEqual(MOCK_TEMPLATES[0]);
    expect(mockFindById).toHaveBeenCalledWith("T1");
  });

  it("throws NotFoundError when template does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(getNotificationTemplateById("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
  });
});
