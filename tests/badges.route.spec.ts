// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockRequireAuth = vi.fn();
const mockRequireAnyRole = vi.fn();
const mockGetNavBadges = vi.fn();

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/shared/get-nav-badges.service", () => ({
  getNavBadges: (...args: any[]) => mockGetNavBadges(...args),
}));

import { GET } from "@/app/api/v1/badges/route";
import { AuthorizationError, AuthenticationError } from "@/lib/errors";

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/v1/badges", {
    method: "GET",
  });
}

describe("GET /api/v1/badges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
    mockRequireAnyRole.mockImplementation((user) => user);
    mockGetNavBadges.mockResolvedValue({
      approvals: 3,
      extensionApprovals: 1,
      overdue: 2,
    });
  });

  it("returns aggregated badge counts for staff roles", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      approvals: 3,
      extensionApprovals: 1,
      overdue: 2,
    });
    expect(mockGetNavBadges).toHaveBeenCalledWith(
      expect.objectContaining({ id: "U1" })
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(new AuthenticationError());

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("rejects STUDENT role (badges are staff-only)", async () => {
    mockRequireAnyRole.mockImplementation(() => {
      throw new AuthorizationError();
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("propagates service failures as error envelope", async () => {
    mockGetNavBadges.mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(mockGetNavBadges).toHaveBeenCalledTimes(1);
  });
});
