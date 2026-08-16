// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockIncrement = vi.fn();

vi.mock("@/db/repositories/rate-limit/rate-limit.repository", () => ({
  rateLimitRepository: {
    increment: (...args: any[]) => mockIncrement(...args),
  },
}));

import { rateLimit } from "@/lib/rate-limiter";
import { ValidationError } from "@/lib/errors";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rateLimit", () => {
  it("allows requests within the window", async () => {
    mockIncrement.mockResolvedValue({
      key: "approve-decision:tok",
      count: 3,
      resetAt: new Date(Date.now() + 600_000),
    });

    await expect(rateLimit("approve-decision:tok", 10, 900_000)).resolves.toBeUndefined();
  });

  it("throws ValidationError once the limit is exceeded", async () => {
    mockIncrement.mockResolvedValue({
      key: "approve-decision:tok",
      count: 11,
      resetAt: new Date(Date.now() + 300_000),
    });

    await expect(rateLimit("approve-decision:tok", 10, 900_000)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("resets the window when the server reports a fresh counter", async () => {
    mockIncrement.mockResolvedValue({
      key: "approve-decision:tok",
      count: 1,
      resetAt: new Date(Date.now() + 900_000),
    });

    await expect(rateLimit("approve-decision:tok", 10, 900_000)).resolves.toBeUndefined();
  });

  it("forwards the key and window to the repository", async () => {
    mockIncrement.mockResolvedValue({
      key: "k",
      count: 1,
      resetAt: new Date(),
    });

    await rateLimit("approve-decision:abc", 5, 60_000);

    expect(mockIncrement).toHaveBeenCalledWith("approve-decision:abc", 60_000);
  });
});
