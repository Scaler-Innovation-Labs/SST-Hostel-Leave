// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockParentFindById = vi.fn();
const mockVerifyParentJwt = vi.fn();

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findById: (...args: any[]) => mockParentFindById(...args),
  },
}));

vi.mock("@/lib/jwt", () => ({
  PARENT_JWT_COOKIE: "parent_token",
  verifyParentJwt: (...args: any[]) => mockVerifyParentJwt(...args),
}));

import { getParentProfile } from "@/services/parent/get-parent-profile.service";
import { AuthenticationError } from "@/lib/errors";

const MOCK_PARENT = { id: "P1", name: "Parent Name", phone: "+1234567890", email: null, relationship: "FATHER", studentId: "S1", isPrimary: true };

beforeEach(() => {
  vi.resetAllMocks();
  mockParentFindById.mockResolvedValue(MOCK_PARENT);
  mockVerifyParentJwt.mockResolvedValue({ sub: "P1" });
});

describe("getParentProfile service", () => {
  it("returns parent profile from cookie", async () => {
    const result = await getParentProfile("parent_token=valid-jwt; other=val");

    expect(result).toEqual(MOCK_PARENT);
    expect(mockParentFindById).toHaveBeenCalledWith("P1");
  });

  it("throws AuthenticationError when no token cookie present", async () => {
    await expect(getParentProfile("other=val")).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("throws AuthenticationError when parent not found", async () => {
    mockParentFindById.mockResolvedValue(null);

    await expect(getParentProfile("parent_token=valid-jwt")).rejects.toBeInstanceOf(AuthenticationError);
  });
});
