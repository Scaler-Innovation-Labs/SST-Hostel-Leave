// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListTemplates = vi.fn();
const mockSaveTemplate = vi.fn();
const mockFindById = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/notification/list-notification-templates.service", () => ({
  listNotificationTemplates: (...args: any[]) => mockListTemplates(...args),
  getNotificationTemplateById: (...args: any[]) => mockFindById(...args),
}));

vi.mock("@/services/notification/save-notification-template.service", () => ({
  saveNotificationTemplate: (...args: any[]) => mockSaveTemplate(...args),
}));

vi.mock("@/services/notification/update-notification-template.service", () => ({
  updateNotificationTemplate: (...args: any[]) => mockUpdate(...args),
}));

vi.mock("@/services/notification/delete-notification-template.service", () => ({
  deleteNotificationTemplate: (...args: any[]) => mockDelete(...args),
}));

import { GET as GET_LIST, POST } from "@/app/api/v1/notification-templates/route";
import { GET as GET_BY_ID, PUT, DELETE } from "@/app/api/v1/notification-templates/[id]/route";

const MOCK_TEMPLATES = [{ id: "T1", code: "leave_approved", eventKey: "LEAVE_APPROVED", channel: "EMAIL", templateBody: "Your leave is approved", isActive: true }];

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockListTemplates.mockResolvedValue(MOCK_TEMPLATES);
  mockSaveTemplate.mockResolvedValue(MOCK_TEMPLATES[0]);
  mockFindById.mockResolvedValue(MOCK_TEMPLATES[0]);
  mockUpdate.mockResolvedValue(MOCK_TEMPLATES[0]);
  mockDelete.mockResolvedValue({ deleted: true });
});

describe("GET /api/v1/notification-templates", () => {
  it("returns list of templates", async () => {
    const res = await GET_LIST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(MOCK_TEMPLATES);
  });
});

describe("POST /api/v1/notification-templates", () => {
  it("creates a template", async () => {
    const req = new Request("http://localhost:3000/api/v1/notification-templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "leave_approved", eventKey: "LEAVE_APPROVED", channel: "EMAIL", templateBody: "Approved", isActive: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("returns 400 for invalid body", async () => {
    const req = new Request("http://localhost:3000/api/v1/notification-templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/notification-templates/[id]", () => {
  it("returns template by id", async () => {
    const req = new Request("http://localhost:3000/api/v1/notification-templates/T1");
    const res = await GET_BY_ID(req, { params: Promise.resolve({ id: "T1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe("T1");
  });
});

describe("PUT /api/v1/notification-templates/[id]", () => {
  it("updates a template", async () => {
    const req = new Request("http://localhost:3000/api/v1/notification-templates/T1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateBody: "Updated body" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "T1" }) });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/v1/notification-templates/[id]", () => {
  it("deletes a template", async () => {
    const req = new Request("http://localhost:3000/api/v1/notification-templates/T1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "T1" }) });
    expect(res.status).toBe(200);
  });
});
