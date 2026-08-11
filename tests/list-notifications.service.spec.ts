// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByUserIdPaginated = vi.fn();
const mockMarkAsRead = vi.fn();

vi.mock("@/db/repositories/notification/notification-log.repository", () => ({
  notificationLogRepository: {
    findByUserIdPaginated: (...args: any[]) => mockFindByUserIdPaginated(...args),
    markAsRead: (...args: any[]) => mockMarkAsRead(...args),
  },
}));

import { listNotifications, markNotificationsRead } from "@/services/notification/list-notifications.service";

const MOCK_RESULT = {
  items: [{ id: "NL1", eventType: "LEAVE_APPROVED", deliveryStatus: "SENT" }],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByUserIdPaginated.mockResolvedValue(MOCK_RESULT);
  mockMarkAsRead.mockResolvedValue(undefined);
});

describe("listNotifications service", () => {
  it("returns paginated notifications for a user", async () => {
    const result = await listNotifications("U1", 1, 20);

    expect(result).toEqual(MOCK_RESULT);
    expect(mockFindByUserIdPaginated).toHaveBeenCalledWith("U1", 1, 20);
  });
});

describe("markNotificationsRead service", () => {
  it("marks notifications as read", async () => {
    await markNotificationsRead(["NL1", "NL2"]);

    expect(mockMarkAsRead).toHaveBeenCalledWith(["NL1", "NL2"]);
  });
});
