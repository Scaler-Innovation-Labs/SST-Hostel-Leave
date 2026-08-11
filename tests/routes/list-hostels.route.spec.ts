// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListHostels = vi.fn();
const mockGetHostelById = vi.fn();
const mockCreateHostel = vi.fn();
const mockUpdateHostel = vi.fn();
const mockDeleteHostel = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/hostel/list-hostels.service", () => ({
  listHostels: (...args: any[]) => mockListHostels(...args),
}));

vi.mock("@/services/hostel/get-hostel.service", () => ({
  getHostelById: (...args: any[]) => mockGetHostelById(...args),
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

import { GET as GET_LIST, POST } from "@/app/api/v1/hostels/route";
import { GET as GET_BY_ID, PUT, DELETE } from "@/app/api/v1/hostels/[id]/route";

const MOCK_HOSTELS = [{ id: "H1", code: "BH1", name: "Boys Hostel", capacity: 200, isActive: true }];

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockListHostels.mockResolvedValue(MOCK_HOSTELS);
  mockGetHostelById.mockResolvedValue(MOCK_HOSTELS[0]);
  mockCreateHostel.mockResolvedValue(MOCK_HOSTELS[0]);
  mockUpdateHostel.mockResolvedValue(MOCK_HOSTELS[0]);
  mockDeleteHostel.mockResolvedValue(undefined);
});

describe("GET /api/v1/hostels", () => {
  it("returns list of hostels", async () => {
    const res = await GET_LIST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(MOCK_HOSTELS);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const res = await GET_LIST();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/hostels", () => {
  it("creates a hostel", async () => {
    const req = new Request("http://localhost:3000/api/v1/hostels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "BH1", name: "Boys Hostel", capacity: 200 }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it("returns 400 for invalid body", async () => {
    const req = new Request("http://localhost:3000/api/v1/hostels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/hostels/[id]", () => {
  it("returns hostel by id", async () => {
    const req = new Request("http://localhost:3000/api/v1/hostels/H1");
    const res = await GET_BY_ID(req, { params: Promise.resolve({ id: "H1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe("H1");
  });

  it("returns 404 when not found", async () => {
    mockGetHostelById.mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/v1/hostels/NONEXISTENT");
    const res = await GET_BY_ID(req, { params: Promise.resolve({ id: "NONEXISTENT" }) });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/v1/hostels/[id]", () => {
  it("updates a hostel", async () => {
    const req = new Request("http://localhost:3000/api/v1/hostels/H1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "BH1", name: "Updated", capacity: 250 }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "H1" }) });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/v1/hostels/[id]", () => {
  it("deletes a hostel", async () => {
    const req = new Request("http://localhost:3000/api/v1/hostels/H1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "H1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.deleted).toBe(true);
  });
});
