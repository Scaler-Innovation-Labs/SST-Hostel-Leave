// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockTxClient = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue([]),
  returning: vi.fn().mockResolvedValue([]),
  limit: vi.fn().mockResolvedValue([]),
};

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb(mockTxClient),
}));

const mockStudentFindById = vi.fn();
const mockRecordMovement = vi.fn();

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: (...args: any[]) => mockStudentFindById(...args),
  },
}));

vi.mock("@/services/movement/record-movement.service", () => ({
  recordMovement: (...args: any[]) => mockRecordMovement(...args),
}));

import { manualCheckout } from "@/services/movement/manual-checkout.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
});

describe("manualCheckout service", () => {
  describe("precondition validation", () => {
    it("throws NotFoundError when student does not exist", async () => {
      mockStudentFindById.mockResolvedValue(null);

      await expect(
        manualCheckout({ studentId: "NONEXISTENT", recordedBy: "U1" })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws ConflictError when student is CHECKED_OUT", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "CHECKED_OUT",
      });

      await expect(
        manualCheckout({ studentId: "S1", recordedBy: "U1" })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("throws ConflictError when student is OUTSIDE_HOSTEL", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "OUTSIDE_HOSTEL",
      });

      await expect(
        manualCheckout({ studentId: "S1", recordedBy: "U1" })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("throws ConflictError when student is OVERDUE", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "OVERDUE",
      });

      await expect(
        manualCheckout({ studentId: "S1", recordedBy: "U1" })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("successful manual checkout", () => {
    it("records movement from IN_HOSTEL to CHECKED_OUT", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "IN_HOSTEL",
      });

      const result = await manualCheckout({
        studentId: "S1",
        recordedBy: "U1",
        reason: "Lost QR card",
      });

      expect(result).toEqual({
        movementEventId: "ME1",
        studentId: "S1",
        newState: "CHECKED_OUT",
      });
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "S1",
          fromState: "IN_HOSTEL",
          toState: "CHECKED_OUT",
          eventType: "MANUAL_CHECKOUT",
          movementMethod: "MANUAL",
          recordedBy: "U1",
          isManualOverride: true,
          overrideReason: "Lost QR card",
          dbClient: expect.any(Object),
        })
      );
    });

    it("records movement from APPROVED_LEAVE to CHECKED_OUT", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "APPROVED_LEAVE",
      });

      await manualCheckout({
        studentId: "S1",
        recordedBy: "U1",
      });

      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: "APPROVED_LEAVE",
          toState: "CHECKED_OUT",
        })
      );
    });

    it("passes leaveRequestId when provided", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "IN_HOSTEL",
      });

      await manualCheckout({
        studentId: "S1",
        leaveRequestId: "LR1",
        recordedBy: "U1",
      });

      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          leaveRequestId: "LR1",
        })
      );
    });
  });

  describe("transaction atomicity", () => {
    it("performs recordMovement in transaction", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "IN_HOSTEL",
      });

      await manualCheckout({ studentId: "S1", recordedBy: "U1" });

      expect(mockRecordMovement).toHaveBeenCalledTimes(1);
    });

    it("propagates recordMovement failure", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "IN_HOSTEL",
      });
      mockRecordMovement.mockRejectedValue(
        new ConflictError("Student state mismatch")
      );

      await expect(
        manualCheckout({ studentId: "S1", recordedBy: "U1" })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
});
