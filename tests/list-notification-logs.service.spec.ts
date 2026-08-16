// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByFilters = vi.fn();
const mockGetScopedHostelIds = vi.fn().mockReturnValue([]);

vi.mock("@/db/repositories/notification/notification-log.repository", () => ({
  notificationLogRepository: {
    findByFilters: (...args: any[]) => mockFindByFilters(...args),
  },
}));

vi.mock("@/services/shared/authorization.service", () => ({
  getScopedHostelIds: (...args: any[]) => mockGetScopedHostelIds(...args),
}));

import { listNotificationLogs } from "@/services/notification/list-notification-logs.service";

const MOCK_RESULT = {
  items: [{ id: "NL1", eventType: "LEAVE_APPROVED", channel: "EMAIL", deliveryStatus: "SENT" }],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

const SUPER_ADMIN = { id: "U1", roles: ["SUPER_ADMIN"] };
const SCOPED_ADMIN = {
  id: "U2",
  roles: ["ADMIN"],
  roleScopes: [{ roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" }],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByFilters.mockResolvedValue(MOCK_RESULT);
  mockGetScopedHostelIds.mockReturnValue([]);
});

describe("listNotificationLogs service", () => {
  it("returns paginated notification logs for an unrestricted admin", async () => {
    const result = await listNotificationLogs({ page: 1, limit: 20 }, SUPER_ADMIN);

    expect(result).toEqual(MOCK_RESULT);
    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, hostelIds: undefined })
    );
  });

  it("scopes logs to the admin's hostels", async () => {
    mockGetScopedHostelIds.mockReturnValue(["H1"]);

    await listNotificationLogs({ page: 1, limit: 20 }, SCOPED_ADMIN);

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ hostelIds: ["H1"] })
    );
  });

  it("passes eventType filter", async () => {
    await listNotificationLogs({ page: 1, limit: 20, eventType: "LEAVE_APPROVED" }, SUPER_ADMIN);

    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ eventType: "LEAVE_APPROVED" }));
  });

  it("passes channel filter", async () => {
    await listNotificationLogs({ page: 1, limit: 20, channel: "SMS" }, SUPER_ADMIN);

    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ channel: "SMS" }));
  });

  it("passes status filter", async () => {
    await listNotificationLogs({ page: 1, limit: 20, status: "SENT" }, SUPER_ADMIN);

    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ status: "SENT" }));
  });

  it("passes date range filters", async () => {
    await listNotificationLogs({ page: 1, limit: 20, dateFrom: "2026-06-01", dateTo: "2026-06-10" }, SUPER_ADMIN);

    expect(mockFindByFilters).toHaveBeenCalledWith(expect.objectContaining({ dateFrom: "2026-06-01", dateTo: "2026-06-10" }));
  });
});
