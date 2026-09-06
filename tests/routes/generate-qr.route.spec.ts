// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGenerateQrPass = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
const mockRequireRole = vi.fn().mockReturnValue({ id: "U1", roles: ["STUDENT"] });

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

vi.mock("@/lib/rate-limiter", () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireRole: (...args: any[]) => mockRequireRole(...args),
}));

vi.mock("@/services/movement/generate-qr.service", () => ({
  generateQrPass: (...args: any[]) => mockGenerateQrPass(...args),
}));

import { POST } from "@/app/api/v1/movements/generate-qr/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
  mockRequireRole.mockReturnValue({ id: "U1", roles: ["STUDENT"] });
  mockGenerateQrPass.mockResolvedValue({ passId: "QP1", tokenHash: "hash", qrType: "LEAVE_EXIT" });
});

describe("POST /api/v1/movements/generate-qr", () => {
  it("generates a QR pass", async () => {
    const req = new Request("http://localhost:3000/api/v1/movements/generate-qr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leaveRequestId: "550e8400-e29b-41d4-a716-446655440000", qrType: "LEAVE_EXIT" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.passId).toBe("QP1");
    // The raw token never leaves the server — the app renders the hosted image.
    expect(body.data).not.toHaveProperty("token");
    expect(mockGenerateQrPass).toHaveBeenCalledWith(
      expect.objectContaining({ leaveRequestId: "550e8400-e29b-41d4-a716-446655440000", userId: "U1" })
    );
  });

  it("returns 400 for invalid body", async () => {
    const req = new Request("http://localhost:3000/api/v1/movements/generate-qr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
