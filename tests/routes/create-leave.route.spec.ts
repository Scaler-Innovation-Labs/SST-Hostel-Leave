// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreateLeave = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["STUDENT"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/leave/create-leave.service", () => ({
  createLeave: (...args: any[]) => mockCreateLeave(...args),
}));

vi.mock("@/lib/rate-limiter", () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/v1/leaves/route";
import { rateLimit } from "@/lib/rate-limiter";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["STUDENT"] });
  mockCreateLeave.mockResolvedValue({ id: "L1", status: "PENDING" });
});

describe("POST /api/v1/leaves", () => {
  const validBody = {
    leaveTypeId: "bb4d56d5-1b13-4f4f-9f7d-4f8b7c4d6e2a",
    reason: "Visiting parents for the weekend",
    startAt: "2026-09-01T10:00:00.000Z",
    endAt: "2026-09-03T18:00:00.000Z",
  };

  it("creates a leave and enforces rate-limiting", async () => {
    const req = new Request("http://localhost:3000/api/v1/leaves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(rateLimit).toHaveBeenCalledWith("create-leave:U1", 20, 60_000);
    expect(mockCreateLeave).toHaveBeenCalledWith(
      expect.objectContaining(validBody),
      expect.objectContaining({ id: "U1" })
    );
  });

  it("creates a leave with selected approvalContactId", async () => {
    const bodyWithContact = {
      ...validBody,
      approvalContactId: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
    };
    const req = new Request("http://localhost:3000/api/v1/leaves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bodyWithContact),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockCreateLeave).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalContactId: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
      }),
      expect.objectContaining({ id: "U1" })
    );
  });

  it("returns 400 when body fails validation", async () => {
    const req = new Request("http://localhost:3000/api/v1/leaves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "too short" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });
});
