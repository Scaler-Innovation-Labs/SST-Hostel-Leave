// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListAdmin = vi.fn();
const mockCreateLeaveType = vi.fn();
const mockGetLeaveType = vi.fn();
const mockUpdateLeaveType = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/leave/list-leave-types-admin.service", () => ({
  listLeaveTypesAdmin: (...args: any[]) => mockListAdmin(...args),
}));

vi.mock("@/services/leave/create-leave-type.service", () => ({
  createLeaveType: (...args: any[]) => mockCreateLeaveType(...args),
}));

vi.mock("@/services/leave/get-leave-type.service", () => ({
  getLeaveTypeById: (...args: any[]) => mockGetLeaveType(...args),
}));

vi.mock("@/services/leave/update-leave-type.service", () => ({
  updateLeaveType: (...args: any[]) => mockUpdateLeaveType(...args),
}));

import { GET as GET_LIST, POST } from "@/app/api/v1/admin/leave-types/route";
import { GET as GET_BY_ID, PUT } from "@/app/api/v1/admin/leave-types/[id]/route";

const MOCK_TYPES = [{ id: "LT1", code: "HOME_PASS", name: "Home Pass", isActive: true }];

const VALID_CREATE_BODY = {
  code: "HOME_PASS",
  name: "Home Pass",    category: "HOME_PASS",
    workflowMode: "HOSTEL",
  qrMode: "EXIT_ONLY",
  allowExtensions: true,
  maxExtensionCount: 3,
  isActive: true,
  useGlobalNotificationRules: true,
  formSchema: {
    fields: [
      { key: "reason", label: "Reason", type: "text", required: true },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockListAdmin.mockResolvedValue(MOCK_TYPES);
  mockCreateLeaveType.mockResolvedValue(MOCK_TYPES[0]);
  mockGetLeaveType.mockResolvedValue(MOCK_TYPES[0]);
  mockUpdateLeaveType.mockResolvedValue(MOCK_TYPES[0]);
});

describe("GET /api/v1/admin/leave-types", () => {
  it("returns leave types", async () => {
    const res = await GET_LIST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(MOCK_TYPES);
  });
});

describe("POST /api/v1/admin/leave-types", () => {
  it("creates a leave type", async () => {
    const req = new Request("http://localhost:3000/api/v1/admin/leave-types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_CREATE_BODY),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

describe("GET /api/v1/admin/leave-types/[id]", () => {
  it("returns leave type by id", async () => {
    const req = new Request("http://localhost:3000/api/v1/admin/leave-types/LT1");
    const res = await GET_BY_ID(req, { params: Promise.resolve({ id: "LT1" }) });
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/v1/admin/leave-types/[id]", () => {
  it("updates a leave type", async () => {
    const req = new Request("http://localhost:3000/api/v1/admin/leave-types/LT1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_CREATE_BODY),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "LT1" }) });
    expect(res.status).toBe(200);
  });
});
