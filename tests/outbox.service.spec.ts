// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockCreateMany = vi.fn();

vi.mock("@/db/repositories/outbox/outbox.repository", () => ({
  outboxRepository: {
    create: (...args: any[]) => mockCreate(...args),
    createMany: (...args: any[]) => mockCreateMany(...args),
  },
}));

import { outboxService } from "@/services/outbox/outbox.service";
import { ValidationError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockCreate.mockResolvedValue({ id: "OE1" });
  mockCreateMany.mockResolvedValue([]);
});

const validInput = {
  eventType: "LEAVE_CREATED",
  aggregateType: "LEAVE_REQUEST",
  aggregateId: "L1",
  payload: { leaveId: "L1" },
};

describe("outboxService", () => {
  describe("publish", () => {
    it("creates an outbox event with PENDING status", async () => {
      await outboxService.publish(validInput);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "LEAVE_CREATED",
          aggregateType: "LEAVE_REQUEST",
          aggregateId: "L1",
          payload: { leaveId: "L1" },
          status: "PENDING",
          attemptCount: 0,
        }),
        undefined
      );
    });

    it("passes dbClient when provided", async () => {
      const mockClient = { insert: vi.fn(), select: vi.fn(), update: vi.fn() };

      await outboxService.publish(validInput, mockClient);

      expect(mockCreate).toHaveBeenCalledWith(expect.any(Object), mockClient);
    });

    it("throws ValidationError when eventType is missing", async () => {
      await expect(
        outboxService.publish({ ...validInput, eventType: "" })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("throws ValidationError when aggregateType is missing", async () => {
      await expect(
        outboxService.publish({ ...validInput, aggregateType: "" })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("throws ValidationError when aggregateId is missing", async () => {
      await expect(
        outboxService.publish({ ...validInput, aggregateId: "" })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("throws ValidationError when payload is missing", async () => {
      await expect(
        outboxService.publish({ ...validInput, payload: undefined })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("publishMany", () => {
    it("creates multiple outbox events", async () => {
      const inputs = [
        validInput,
        {
          eventType: "LEAVE_APPROVED",
          aggregateType: "LEAVE_REQUEST",
          aggregateId: "L2",
          payload: { leaveId: "L2" },
        },
      ];

      await outboxService.publishMany(inputs);

      expect(mockCreateMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ eventType: "LEAVE_CREATED", aggregateId: "L1" }),
          expect.objectContaining({ eventType: "LEAVE_APPROVED", aggregateId: "L2" }),
        ]),
        undefined
      );
    });

    it("validates all inputs before creating", async () => {
      const inputs = [
        validInput,
        { ...validInput, eventType: "" },
      ];

      await expect(outboxService.publishMany(inputs)).rejects.toBeInstanceOf(ValidationError);
      expect(mockCreateMany).not.toHaveBeenCalled();
    });

    it("passes dbClient to createMany", async () => {
      const mockClient = { insert: vi.fn(), select: vi.fn(), update: vi.fn() };

      await outboxService.publishMany([validInput], mockClient);

      expect(mockCreateMany).toHaveBeenCalledWith(expect.any(Array), mockClient);
    });
  });
});
