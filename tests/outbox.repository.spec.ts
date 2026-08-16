// @ts-nocheck
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSet = vi.fn();
const mockWhere = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: (...args: any[]) => {
        mockSet(...args);
        return {
          where: (...wargs: any[]) => {
            mockWhere(...wargs);
            return { returning: vi.fn().mockResolvedValue([]) };
          },
        };
      },
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

import { outboxRepository } from "@/db/repositories/outbox/outbox.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("outboxRepository", () => {
  it("markProcessing claims with a claimedAt timestamp", async () => {
    await outboxRepository.markProcessing("OE1");

    const setArgs = mockSet.mock.calls[0][0];
    expect(setArgs.status).toBe("PROCESSING");
    expect(setArgs.claimedAt).toBeInstanceOf(Date);
  });

  it("releaseForRetry resets a PROCESSING event to PENDING and counts the attempt", async () => {
    await outboxRepository.releaseForRetry("OE1");

    const setArgs = mockSet.mock.calls[0][0];
    expect(setArgs.status).toBe("PENDING");
    expect(setArgs.claimedAt).toBeNull();
    expect(setArgs.attemptCount).toBeDefined();
    const sqlText = (setArgs.attemptCount.queryChunks ?? [])
      .map((c: unknown) => {
        const raw = (c as { value?: unknown[] })?.value;
        return Array.isArray(raw) ? raw.join("") : "?";
      })
      .join("");
    expect(sqlText).toContain("COALESCE");
    expect(sqlText).toContain("+");
  });

  it("markFailed stores the error and the given attempt budget", async () => {
    await outboxRepository.markFailed("OE1", "boom", 5);

    const setArgs = mockSet.mock.calls[0][0];
    expect(setArgs.status).toBe("FAILED");
    expect(setArgs.lastError).toBe("boom");
    expect(setArgs.attemptCount).toBe(5);
  });

  it("markFailed omits attemptCount when not provided", async () => {
    await outboxRepository.markFailed("OE1", "boom");

    const setArgs = mockSet.mock.calls[0][0];
    expect(setArgs.attemptCount).toBeUndefined();
  });

  it("requeueStuckProcessing requeues stale PROCESSING claims only", async () => {
    const count = await outboxRepository.requeueStuckProcessing(15);

    expect(count).toBe(0);
    const setArgs = mockSet.mock.calls[0][0];
    expect(setArgs.status).toBe("PENDING");
    expect(setArgs.claimedAt).toBeNull();
    expect(mockWhere).toHaveBeenCalled();
  });
});