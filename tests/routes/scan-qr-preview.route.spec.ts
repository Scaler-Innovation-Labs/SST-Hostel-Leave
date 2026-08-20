// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockPreviewQrScan = vi.fn();
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
  previewQrScan: (...args: any[]) => mockPreviewQrScan(...args),
}));

import { GET } from "@/app/api/v1/movements/scan/preview/route";

const VALID_PREVIEW = {
  valid: true,
  scanType: "EXIT_SCAN",
  student: {
    name: "John Doe",
    rollNumber: "STU-001",
    roomNumber: "A-101",
    hostelName: "Alpha Hostel",
  },
  leave: {
    typeName: "Home Visit",
    startAt: "2026-08-20T10:00:00.000Z",
    endAt: "2026-08-22T10:00:00.000Z",
    status: "APPROVED",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["GUARD"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["GUARD"] });
  mockPreviewQrScan.mockResolvedValue(VALID_PREVIEW);
});

describe("GET /api/v1/movements/scan/preview", () => {
  it("previews a scannable QR token", async () => {
    const req = new Request(
      "http://localhost:3000/api/v1/movements/scan/preview?token=qr-token-123",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.valid).toBe(true);
    expect(body.data.student.name).toBe("John Doe");
    expect(body.data.scanType).toBe("EXIT_SCAN");
    expect(mockPreviewQrScan).toHaveBeenCalledWith("qr-token-123");
  });

  it("returns 400 when token is missing", async () => {
    const req = new Request(
      "http://localhost:3000/api/v1/movements/scan/preview",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockPreviewQrScan).not.toHaveBeenCalled();
  });

  it("returns 400 when token is blank", async () => {
    const req = new Request(
      "http://localhost:3000/api/v1/movements/scan/preview?token=%20%20",
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(mockPreviewQrScan).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const req = new Request(
      "http://localhost:3000/api/v1/movements/scan/preview?token=qr-token-123",
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});