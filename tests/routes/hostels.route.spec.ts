// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreateHostel = vi.fn();
const mockUpdateHostel = vi.fn();
const mockDeleteHostel = vi.fn();
const mockGetHostel = vi.fn();
const mockListHostels = vi.fn();
const mockIsStaffScopeRestricted = vi.fn();
const mockGetScopedHostelIds = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/shared/authorization.service", () => ({
  isStaffScopeRestricted: (...args: any[]) => mockIsStaffScopeRestricted(...args),
  getScopedHostelIds: (...args: any[]) => mockGetScopedHostelIds(...args),
}));

vi.mock("@/services/hostel/create-hostel.service", () => ({
  createHostel: (...args: any[]) => mockCreateHostel(...args),
}));

vi.mock("@/services/hostel/update-hostel.service", () => ({
  updateHostel: (...args: any[]) => mockUpdateHostel(...args),
}));

vi.mock("@/services/hostel/delete-hostel.service", () => ({
  deleteHostel: (...args: any[]) => mockDeleteHostel(...args),
}));

vi.mock("@/services/hostel/get-hostel.service", () => ({
  getHostelById: (...args: any[]) => mockGetHostel(...args),
}));

vi.mock("@/services/hostel/list-hostels.service", () => ({
  listHostels: (...args: any[]) => mockListHostels(...args),
}));

import { POST } from "@/app/api/v1/hostels/route";
import { PUT, DELETE } from "@/app/api/v1/hostels/[id]/route";

const HOSTEL = { id: "H1", code: "UNI_1", name: "Uni Hostel 1", isActive: true };

const VALID_BODY = { name: "Uni Hostel 1", code: "UNI_1", capacity: 100, isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockCreateHostel.mockResolvedValue(HOSTEL);
  mockUpdateHostel.mockResolvedValue(HOSTEL);
  mockDeleteHostel.mockResolvedValue({ deleted: true });
  mockIsStaffScopeRestricted.mockReturnValue(false);
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/hostels", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/hostels", () => {
  it("creates a hostel with the authenticated actor", async () => {
    const res = await POST(jsonReq(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(HOSTEL);
    expect(mockCreateHostel).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Uni Hostel 1", code: "UNI_1" }),
      { id: "U1", roles: ["SUPER_ADMIN"] },
    );
  });

  it("rejects a body missing required fields", async () => {
    const res = await POST(jsonReq({ name: "No Code" }));

    expect(res.status).toBe(400);
    expect(mockCreateHostel).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v1/hostels/[id]", () => {
  it("updates a hostel", async () => {
    const res = await PUT(jsonReq(VALID_BODY), { params: Promise.resolve({ id: "H1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(HOSTEL);
    expect(mockUpdateHostel).toHaveBeenCalledWith(
      "H1",
      expect.objectContaining({ code: "UNI_1" }),
      { id: "U1", roles: ["SUPER_ADMIN"] },
    );
  });
});

describe("DELETE /api/v1/hostels/[id]", () => {
  it("deletes a hostel", async () => {
    const res = await DELETE(new Request("http://localhost:3000/api/v1/hostels/H1"), {
      params: Promise.resolve({ id: "H1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ deleted: true });
    expect(mockDeleteHostel).toHaveBeenCalledWith("H1", { id: "U1", roles: ["SUPER_ADMIN"] });
  });
});
