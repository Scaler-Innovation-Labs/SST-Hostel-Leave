// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockApproveExtension = vi.fn();
const mockRejectExtension = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/leave/approve-extension.service", () => ({
  approveExtension: (...args: any[]) => mockApproveExtension(...args),
}));

vi.mock("@/services/leave/reject-extension.service", () => ({
  rejectExtension: (...args: any[]) => mockRejectExtension(...args),
}));

import { POST } from "@/app/api/v1/extensions/[id]/approve/route";

const EXT_ID = "550e8400-e29b-41d4-a716-446655440000";
const USER = { id: "U1", roles: ["ADMIN"] };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(USER);
  mockRequireAnyRole.mockReturnValue(USER);
  mockApproveExtension.mockResolvedValue({ id: EXT_ID, status: "APPROVED" });
  mockRejectExtension.mockResolvedValue({ id: EXT_ID, status: "REJECTED" });
});

function jsonReq(body: unknown): Request {
  return new Request(`http://localhost:3000/api/v1/extensions/${EXT_ID}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/extensions/[id]/approve", () => {
  it("approves an extension", async () => {
    const res = await POST(jsonReq({ decision: "APPROVED" }), {
      params: Promise.resolve({ id: EXT_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockApproveExtension).toHaveBeenCalledWith(
      EXT_ID,
      expect.objectContaining({ decision: "APPROVED" }),
      USER,
    );
    expect(mockRejectExtension).not.toHaveBeenCalled();
  });

  it("rejects an extension when decision is REJECTED", async () => {
    const res = await POST(jsonReq({ decision: "REJECTED" }), {
      params: Promise.resolve({ id: EXT_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRejectExtension).toHaveBeenCalledWith(
      EXT_ID,
      expect.objectContaining({ decision: "REJECTED" }),
      USER,
    );
    expect(mockApproveExtension).not.toHaveBeenCalled();
  });

  it("rejects an invalid decision", async () => {
    const res = await POST(jsonReq({ decision: "MAYBE" }), {
      params: Promise.resolve({ id: EXT_ID }),
    });

    expect(res.status).toBe(400);
    expect(mockApproveExtension).not.toHaveBeenCalled();
    expect(mockRejectExtension).not.toHaveBeenCalled();
  });
});
