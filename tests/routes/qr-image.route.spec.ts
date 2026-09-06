// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { AuthenticationError, AuthorizationError } from "@/lib/errors";
import { encryptQrToken } from "@/lib/qr-token-crypto";

const mockFindById = vi.fn();
const mockRequireAuth = vi.fn();
const mockRequireAnyRole = vi.fn();
const mockVerifyStudentOwnership = vi.fn();

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/shared/authorization.service", () => ({
  verifyStudentOwnership: (...args: any[]) =>
    mockVerifyStudentOwnership(...args),
}));

import { GET } from "@/app/api/v1/qr/[qrPassId]/image/route";

const ownerUser = { id: "U1", roles: ["STUDENT"] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("QR_TOKEN_ENC_KEY", "ab".repeat(32));
  mockRequireAuth.mockResolvedValue(ownerUser);
  mockRequireAnyRole.mockReturnValue(ownerUser);
  mockVerifyStudentOwnership.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/v1/qr/[qrPassId]/image", () => {
  it("renders the PNG from the encrypted envelope for the owning student", async () => {
    mockFindById.mockResolvedValue({
      id: "QP1",
      studentId: "S1",
      tokenEnc: await encryptQrToken("envelope-backed-token"),
    });

    const res = await GET(new Request("http://localhost:3000/api/v1/qr/QP1/image"), {
      params: Promise.resolve({ qrPassId: "QP1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(mockVerifyStudentOwnership).toHaveBeenCalledWith(ownerUser, "S1");
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthenticationError());

    const res = await GET(new Request("http://localhost:3000/api/v1/qr/QP1/image"), {
      params: Promise.resolve({ qrPassId: "QP1" }),
    });

    expect(res.status).toBe(401);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("returns 403 when a student requests another student's pass", async () => {
    mockFindById.mockResolvedValue({
      id: "QP1",
      studentId: "S2",
      tokenEnc: "v1:unused-iv:unused-ciphertext",
    });
    mockVerifyStudentOwnership.mockRejectedValue(
      new AuthorizationError()
    );

    const res = await GET(new Request("http://localhost:3000/api/v1/qr/QP1/image"), {
      params: Promise.resolve({ qrPassId: "QP1" }),
    });

    expect(res.status).toBe(403);
  });

  it("returns 404 when the pass does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost:3000/api/v1/qr/QP1/image"), {
      params: Promise.resolve({ qrPassId: "QP1" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the pass has no credential", async () => {
    mockFindById.mockResolvedValue({ id: "QP1", studentId: "S1", tokenEnc: null });

    const res = await GET(new Request("http://localhost:3000/api/v1/qr/QP1/image"), {
      params: Promise.resolve({ qrPassId: "QP1" }),
    });

    expect(res.status).toBe(404);
  });
});
