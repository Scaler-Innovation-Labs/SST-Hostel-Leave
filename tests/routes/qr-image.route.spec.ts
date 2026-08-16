// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindById = vi.fn();

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

import { GET } from "@/app/api/v1/qr/[qrPassId]/image/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/qr/[qrPassId]/image", () => {
  it("returns the QR pass as a PNG", async () => {
    mockFindById.mockResolvedValue({
      id: "QP1",
      token: "raw-token-stays-server-side",
    });

    const res = await GET(new Request("http://localhost:3000/api/v1/qr/QP1/image"), {
      params: Promise.resolve({ qrPassId: "QP1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("max-age=31536000");
    const bytes = new Uint8Array(await res.arrayBuffer());
    // PNG magic bytes
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(mockFindById).toHaveBeenCalledWith("QP1");
  });

  it("returns 404 when the pass does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost:3000/api/v1/qr/QP1/image"), {
      params: Promise.resolve({ qrPassId: "QP1" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the pass has no token", async () => {
    mockFindById.mockResolvedValue({ id: "QP1", token: null });

    const res = await GET(new Request("http://localhost:3000/api/v1/qr/QP1/image"), {
      params: Promise.resolve({ qrPassId: "QP1" }),
    });

    expect(res.status).toBe(404);
  });
});
