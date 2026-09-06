// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { encryptQrToken } from "@/lib/qr-token-crypto";

const mockFindById = vi.fn();

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

import { GET } from "@/app/api/v1/qr/[qrPassId]/image/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("QR_TOKEN_ENC_KEY", "ab".repeat(32));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/v1/qr/[qrPassId]/image", () => {
  it("renders the PNG from the encrypted envelope (no plaintext stored)", async () => {
    mockFindById.mockResolvedValue({
      id: "QP1",
      tokenEnc: await encryptQrToken("envelope-backed-token"),
    });

    const res = await GET(new Request("http://localhost:3000/api/v1/qr/QP1/image"), {
      params: Promise.resolve({ qrPassId: "QP1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("returns 404 when the pass does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost:3000/api/v1/qr/QP1/image"), {
      params: Promise.resolve({ qrPassId: "QP1" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the pass has no credential", async () => {
    mockFindById.mockResolvedValue({ id: "QP1", tokenEnc: null });

    const res = await GET(new Request("http://localhost:3000/api/v1/qr/QP1/image"), {
      params: Promise.resolve({ qrPassId: "QP1" }),
    });

    expect(res.status).toBe(404);
  });
});
