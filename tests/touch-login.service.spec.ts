// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockTouchLastLogin = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    touchLastLogin: (...args: any[]) => mockTouchLastLogin(...args),
  },
}));

import { touchUserLastLogin } from "@/services/user/touch-login.service";

describe("touchUserLastLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls userRepository.touchLastLogin with userId", async () => {
    await touchUserLastLogin("U123");
    expect(mockTouchLastLogin).toHaveBeenCalledWith("U123");
  });
});
