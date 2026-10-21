// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindById = vi.fn();
const mockDecryptQrToken = vi.fn();
const mockAssertCanAccessLeave = vi.fn();

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

vi.mock("@/lib/qr-token-crypto", () => ({
  decryptQrToken: (...args: any[]) => mockDecryptQrToken(...args),
}));

vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("png")),
  },
}));

vi.mock("@/services/shared/authorization.service", () => ({
  assertCanAccessLeave: (...args: any[]) => mockAssertCanAccessLeave(...args),
}));

import { AuthorizationError, NotFoundError } from "@/lib/errors";
import { getQrImage } from "@/services/movement/get-qr-image.service";

const PASS = {
  id: "QP1",
  studentId: "S1",
  tokenEnc: "envelope",
};

const ADMIN = { id: "U1", roles: ["ADMIN"] };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue(PASS);
  mockDecryptQrToken.mockResolvedValue("raw-token");
  mockAssertCanAccessLeave.mockResolvedValue(undefined);
});

describe("getQrImage service", () => {
  it("throws NotFoundError when the pass does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(getQrImage("QP1", ADMIN)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(mockAssertCanAccessLeave).not.toHaveBeenCalled();
  });

  it("checks access against the pass owner's hostel scope", async () => {
    await getQrImage("QP1", ADMIN);

    expect(mockAssertCanAccessLeave).toHaveBeenCalledWith(ADMIN, {
      studentId: "S1",
    });
  });

  it("refuses to render a pass outside the caller's scope", async () => {
    mockAssertCanAccessLeave.mockRejectedValue(
      new AuthorizationError("You do not have access to this leave"),
    );

    await expect(getQrImage("QP1", ADMIN)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("renders the pass when access is allowed", async () => {
    const result = await getQrImage("QP1", ADMIN);

    expect(result.contentType).toBe("image/png");
    expect(result.cacheControl).toContain("no-cache");
  });
});
