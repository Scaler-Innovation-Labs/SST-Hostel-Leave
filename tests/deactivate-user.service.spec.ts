// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockDeactivate = vi.fn();
const mockActivate = vi.fn();

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    deactivate: (...args: any[]) => mockDeactivate(...args),
    activate: (...args: any[]) => mockActivate(...args),
  },
}));

vi.mock("@/lib/db", () => ({ db: {} }));

import { deactivateUser, activateUser } from "@/services/user/deactivate-user.service";
import { NotFoundError } from "@/lib/errors";

const MOCK_USER = { id: "U1", fullName: "Test User", isActive: false };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("deactivateUser service", () => {
  it("deactivates a user", async () => {
    mockDeactivate.mockResolvedValue(MOCK_USER);

    const result = await deactivateUser("U1");

    expect(result).toEqual(MOCK_USER);
    expect(mockDeactivate).toHaveBeenCalledWith("U1", expect.any(Object));
  });

  it("throws NotFoundError when user does not exist", async () => {
    mockDeactivate.mockResolvedValue(null);

    await expect(deactivateUser("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("activateUser service", () => {
  it("activates a user", async () => {
    mockActivate.mockResolvedValue({ ...MOCK_USER, isActive: true });

    const result = await activateUser("U1");

    expect(result.isActive).toBe(true);
    expect(mockActivate).toHaveBeenCalledWith("U1", expect.any(Object));
  });

  it("throws NotFoundError when user does not exist", async () => {
    mockActivate.mockResolvedValue(null);

    await expect(activateUser("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
  });
});
