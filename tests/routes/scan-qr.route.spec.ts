// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockScanQrPass = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["GUARD"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["GUARD"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/movement/scan-qr.service", () => ({
  scanQrPass: (...args: any[]) => mockScanQrPass(...args),
}));

import { POST } from "@/app/api/v1/movements/scan/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["GUARD"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["GUARD"] });
  mockScanQrPass.mockResolvedValue({ id: "QP1", status: "USED", studentName: "John Doe" });
});

describe("POST /api/v1/movements/scan", () => {
  it("scans a QR pass", async () => {
    const req = new Request("http://localhost:3000/api/v1/movements/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "qr-token-123", qrPassId: "QP1" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe("USED");
    expect(mockScanQrPass).toHaveBeenCalledWith(
      expect.objectContaining({ scannedBy: "U1" })
    );
  });

  it("returns 400 for invalid body", async () => {
    const req = new Request("http://localhost:3000/api/v1/movements/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const req = new Request("http://localhost:3000/api/v1/movements/scan", {
      method: "POST",
      body: JSON.stringify({ token: "test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
