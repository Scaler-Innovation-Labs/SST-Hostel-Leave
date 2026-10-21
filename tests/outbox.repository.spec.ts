// @ts-nocheck
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoNothing = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: (...args: any[]) => {
        mockSet(...args);
        return {
          where: (...wargs: any[]) => {
            mockWhere(...wargs);
            return { returning: mockReturning.mockResolvedValue([]) };
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
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: (...args: any[]) => {
        mockValues(...args);
        return {
          onConflictDoNothing: (...ocArgs: any[]) => {
            mockOnConflictDoNothing(...ocArgs);
            return { returning: mockReturning.mockResolvedValue([]) };
          },
          returning: mockReturning.mockResolvedValue([]),
        };
      },
    }),
  },
}));

import { outboxRepository } from "@/db/repositories/outbox/outbox.repository";

beforeEach(() => {
  vi.clearAllMocks();
  mockReturning.mockResolvedValue([]);
});

describe("outboxRepository", () => {
  it("claimNext maps raw snake_case RETURNING rows to camelCase events", async () => {
    const createdAt = new Date("2026-10-21T06:26:25.847Z");
    const execute = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "OE1",
          event_type: "NOTIFICATION_REQUESTED",
          aggregate_type: "NOTIFICATION",
          aggregate_id: "A1",
          payload: { notificationType: "PARENT_APPROVAL_REQUESTED" },
          idempotency_key: null,
          status: "PROCESSING",
          attempt_count: 0,
          last_error: null,
          next_attempt_at: null,
          lease_expires_at: null,
          created_at: createdAt,
          processed_at: null,
          claimed_at: createdAt,
          published_at: null,
        },
      ],
    });

    const rows = await outboxRepository.claimNext(50, 300_000, { execute });

    expect(execute).toHaveBeenCalled();
    expect(rows[0]).toMatchObject({
      id: "OE1",
      eventType: "NOTIFICATION_REQUESTED",
      aggregateType: "NOTIFICATION",
      aggregateId: "A1",
      status: "PROCESSING",
      attemptCount: 0,
      createdAt,
    });
    expect(rows[0]).not.toHaveProperty("event_type");
  });

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
    // Backoff is scheduled so the retry is not immediately eligible.
    expect(setArgs.nextAttemptAt).toBeInstanceOf(Date);
    const sqlText = (setArgs.attemptCount.queryChunks ?? [])
      .map((c: unknown) => {
        const raw = (c as { value?: unknown[] })?.value;
        return Array.isArray(raw) ? raw.join("") : "?";
      })
      .join("");
    expect(sqlText).toContain("COALESCE");
    expect(sqlText).toContain("+");
  });

  it("markProcessed clears claim, lease, retry, and error state", async () => {
    await outboxRepository.markProcessed("OE1");

    const setArgs = mockSet.mock.calls[0][0];
    expect(setArgs.status).toBe("PROCESSED");
    expect(setArgs.processedAt).toBeInstanceOf(Date);
    expect(setArgs.claimedAt).toBeNull();
    expect(setArgs.leaseExpiresAt).toBeNull();
    expect(setArgs.nextAttemptAt).toBeNull();
    expect(setArgs.lastError).toBeNull();
  });

  it("markFailed stores the error and the given attempt budget", async () => {
    await outboxRepository.markFailed("OE1", "boom", 5);

    const setArgs = mockSet.mock.calls[0][0];
    expect(setArgs.status).toBe("FAILED");
    expect(setArgs.lastError).toBe("boom");
    expect(setArgs.attemptCount).toBe(5);
    expect(setArgs.claimedAt).toBeNull();
    expect(setArgs.leaseExpiresAt).toBeNull();
    expect(setArgs.nextAttemptAt).toBeNull();
  });

  it("markFailed omits attemptCount when not provided", async () => {
    await outboxRepository.markFailed("OE1", "boom");

    const setArgs = mockSet.mock.calls[0][0];
    expect(setArgs.attemptCount).toBeUndefined();
  });

  it("requeueStuckProcessing counts the crashed attempt and clears the lease", async () => {
    const count = await outboxRepository.requeueStuckProcessing(15);

    expect(count).toBe(0);
    const setArgs = mockSet.mock.calls[0][0];
    expect(setArgs.status).toBe("PENDING");
    expect(setArgs.claimedAt).toBeNull();
    expect(setArgs.leaseExpiresAt).toBeNull();
    expect(setArgs.nextAttemptAt).toBeNull();
    expect(setArgs.attemptCount).toBeDefined();
    expect(mockWhere).toHaveBeenCalled();
  });

  it("failStuckProcessing terminal-fails stale claims with no retry budget", async () => {
    mockReturning.mockResolvedValueOnce([{ id: "OE1" }]);

    const count = await outboxRepository.failStuckProcessing(15, 5);

    expect(count).toBe(1);
    const setArgs = mockSet.mock.calls[0][0];
    expect(setArgs.status).toBe("FAILED");
    expect(setArgs.attemptCount).toBe(5);
    expect(setArgs.lastError).toContain("lease expired");
    expect(setArgs.claimedAt).toBeNull();
    expect(setArgs.leaseExpiresAt).toBeNull();
    expect(mockWhere).toHaveBeenCalled();
  });

  it("create uses ON CONFLICT DO NOTHING when idempotencyKey is provided", async () => {
    await outboxRepository.create({
      eventType: "TEST_EVENT",
      aggregateType: "TEST_AGG",
      aggregateId: "11111111-1111-1111-1111-111111111111",
      payload: { foo: "bar" },
      status: "PENDING",
      attemptCount: 0,
      idempotencyKey: "test-key-1",
    });

    expect(mockOnConflictDoNothing).toHaveBeenCalledWith({
      target: expect.any(Object),
    });
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "test-key-1" })
    );
  });

  it("create uses normal insert when idempotencyKey is not provided", async () => {
    await outboxRepository.create({
      eventType: "TEST_EVENT",
      aggregateType: "TEST_AGG",
      aggregateId: "22222222-2222-2222-2222-222222222222",
      payload: { foo: "baz" },
      status: "PENDING",
      attemptCount: 0,
    });

    expect(mockOnConflictDoNothing).not.toHaveBeenCalled();
    const calledWith = mockValues.mock.calls[0][0];
    expect(calledWith).not.toHaveProperty("idempotencyKey");
  });
});