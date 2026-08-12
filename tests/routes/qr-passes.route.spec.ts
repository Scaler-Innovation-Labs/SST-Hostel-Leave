// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListQrPasses = vi.fn();
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["STUDENT"] });

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["STUDENT"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/movement/list-qr-passes.service", () => ({
  listQrPasses: (...args: any[]) => mockListQrPasses(...args),
}));

import { GET } from "@/app/api/v1/movements/qr-passes/route";

const LEAVE_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

describe("GET /api/v1/movements/qr-passes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["STUDENT"] });
  });

  it("lists QR passes for a leave request", async () => {
    mockListQrPasses.mockResolvedValue([
      {
        id: "QP1",
        leaveRequestId: LEAVE_ID,
        status: "ACTIVE",
        qrType: "LEAVE_EXIT",
        firstScanAt: null,
        closedAt: null,
      },
    ]);

    const res = await GET(
      new Request(`http://localhost/api/v1/movements/qr-passes?leaveRequestId=${LEAVE_ID}`),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data[0].status).toBe("ACTIVE");
    expect(mockListQrPasses).toHaveBeenLastCalledWith(LEAVE_ID, expect.objectContaining({ id: "U1" }));
  });

  it("rejects a missing leaveRequestId", async () => {
    const res = await GET(new Request("http://localhost/api/v1/movements/qr-passes"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockListQrPasses).not.toHaveBeenCalled();
  });

  it("rejects an invalid leaveRequestId", async () => {
    const res = await GET(
      new Request("http://localhost/api/v1/movements/qr-passes?leaveRequestId=not-a-uuid"),
    );

    expect(res.status).toBe(400);
    expect(mockListQrPasses).not.toHaveBeenCalled();
  });
});
