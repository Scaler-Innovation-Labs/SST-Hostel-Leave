// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListNotifications = vi.fn();
const mockMarkRead = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["STUDENT"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/services/notification/list-notifications.service", () => ({
  listNotifications: (...args: any[]) => mockListNotifications(...args),
  markNotificationsRead: (...args: any[]) => mockMarkRead(...args),
}));

import { GET } from "@/app/api/v1/notifications/route";
import { POST } from "@/app/api/v1/notifications/read/route";

const MOCK_RESULT = { items: [{ id: "N1", eventType: "LEAVE_APPROVED", deliveryStatus: "SENT" }], total: 1, page: 1, limit: 20, totalPages: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
  mockListNotifications.mockResolvedValue(MOCK_RESULT);
  mockMarkRead.mockResolvedValue(undefined);
});

describe("GET /api/v1/notifications", () => {
  it("returns paginated notifications", async () => {
    const req = new Request("http://localhost:3000/api/v1/notifications?page=1&limit=10");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(mockListNotifications).toHaveBeenCalledWith("U1", 1, 10);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const res = await GET(new Request("http://localhost:3000/api/v1/notifications"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/notifications/read", () => {
  it("marks notifications as read", async () => {
    const req = new Request("http://localhost:3000/api/v1/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"] }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.marked).toBe(2);
    expect(mockMarkRead).toHaveBeenCalledWith(["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"]);
  });

  it("returns 400 for invalid body", async () => {
    const req = new Request("http://localhost:3000/api/v1/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
