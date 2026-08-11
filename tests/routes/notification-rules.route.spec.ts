// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetGlobalRules = vi.fn();
const mockCreateRule = vi.fn();
const mockGetById = vi.fn();
const mockUpdateRule = vi.fn();
const mockDeleteRule = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/notification/notification-rule.service", () => ({
  getGlobalRules: (...args: any[]) => mockGetGlobalRules(...args),
  getNotificationRuleById: (...args: any[]) => mockGetById(...args),
  createNotificationRule: (...args: any[]) => mockCreateRule(...args),
  updateNotificationRule: (...args: any[]) => mockUpdateRule(...args),
  deleteNotificationRule: (...args: any[]) => mockDeleteRule(...args),
}));

import { GET as GET_LIST, POST } from "@/app/api/v1/notification-rules/route";
import { GET as GET_BY_ID, PUT, DELETE } from "@/app/api/v1/notification-rules/[id]/route";

const MOCK_RULES = [{ id: "NR1", eventType: "LEAVE_APPROVED", templateId: "550e8400-e29b-41d4-a716-446655440000", templateCode: "leave_approved", enabled: true, recipientTypes: ["STUDENT"], channels: ["EMAIL"], customRecipients: [], leaveTypeId: null, createdAt: "2026-07-26T09:29:46.097Z", updatedAt: "2026-07-26T09:29:46.098Z" }];

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockGetGlobalRules.mockResolvedValue(MOCK_RULES);
  mockGetById.mockResolvedValue(MOCK_RULES[0]);
  mockCreateRule.mockResolvedValue(MOCK_RULES[0]);
  mockUpdateRule.mockResolvedValue(MOCK_RULES[0]);
  mockDeleteRule.mockResolvedValue(undefined);
});

describe("GET /api/v1/notification-rules", () => {
  it("returns notification rules", async () => {
    const res = await GET_LIST();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual(MOCK_RULES);
  });
});

describe("POST /api/v1/notification-rules", () => {
  it("creates a notification rule", async () => {
    const req = new Request("http://localhost:3000/api/v1/notification-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType: "LEAVE_APPROVED", templateId: "550e8400-e29b-41d4-a716-446655440000", enabled: true, recipientTypes: ["STUDENT"], channels: ["EMAIL"], customRecipients: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/notification-rules/[id]", () => {
  it("returns rule by id", async () => {
    const req = new Request("http://localhost:3000/api/v1/notification-rules/NR1");
    const res = await GET_BY_ID(req, { params: Promise.resolve({ id: "NR1" }) });
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/v1/notification-rules/[id]", () => {
  it("updates a rule", async () => {
    const req = new Request("http://localhost:3000/api/v1/notification-rules/NR1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType: "LEAVE_APPROVED", templateId: "550e8400-e29b-41d4-a716-446655440000", enabled: false, recipientTypes: ["STUDENT"], channels: ["EMAIL"], customRecipients: [] }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "NR1" }) });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/v1/notification-rules/[id]", () => {
  it("deletes a rule", async () => {
    const req = new Request("http://localhost:3000/api/v1/notification-rules/NR1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "NR1" }) });
    expect(res.status).toBe(200);
  });
});
