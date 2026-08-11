// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByFilters = vi.fn();

vi.mock("@/db/repositories/notification/notification-log.repository", () => ({
  notificationLogRepository: {
    findByFilters: (...args: any[]) => mockFindByFilters(...args),
  },
}));

import { listNotificationLogs } from "@/services/notification/list-notification-logs.service";

const MOCK_RESULT = {
  items: [{ id: "NL1", eventType: "LEAVE_APPROVED", channel: "EMAIL", deliveryStatus: "SENT" }],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByFilters.mockResolvedValue(MOCK_RESULT);
});

describe("listNotificationLogs service", () => {
  it("returns paginated notification logs", async () => {
    const result = await listNotificationLogs({ page: 1, limit: 20 });

    expect(result).toEqual(MOCK_RESULT);
    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
  });

  it("passes eventType filter", async () => {
    await listNotificationLogs({ page: 1, limit: 20, eventType: "LEAVE_APPROVED" });

    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ eventType: "LEAVE_APPROVED" }));
  });

  it("passes channel filter", async () => {
    await listNotificationLogs({ page: 1, limit: 20, channel: "SMS" });

    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ channel: "SMS" }));
  });

  it("passes status filter", async () => {
    await listNotificationLogs({ page: 1, limit: 20, status: "SENT" });

    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ status: "SENT" }));
  });

  it("passes date range filters", async () => {
    await listNotificationLogs({ page: 1, limit: 20, dateFrom: "2026-06-01", dateTo: "2026-06-10" });

    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ dateFrom: "2026-06-01", dateTo: "2026-06-10" }));
  });
});
