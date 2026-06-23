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

import { manualReturn } from "@/services/movement/manual-return.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
});

describe("manualReturn service", () => {
  describe("precondition validation", () => {
    it("throws NotFoundError when student does not exist", async () => {
      mockStudentFindById.mockResolvedValue(null);

      await expect(
        manualReturn({ studentId: "NONEXISTENT", recordedBy: "U1" })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws ConflictError when student is IN_HOSTEL", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "IN_HOSTEL",
      });

      await expect(
        manualReturn({ studentId: "S1", recordedBy: "U1" })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("throws ConflictError when student is APPROVED_LEAVE", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "APPROVED_LEAVE",
      });

      await expect(
        manualReturn({ studentId: "S1", recordedBy: "U1" })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("successful manual return", () => {
    it("records movement from CHECKED_OUT to IN_HOSTEL", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "CHECKED_OUT",
      });

      const result = await manualReturn({
        studentId: "S1",
        recordedBy: "U1",
        reason: "Security override",
      });

      expect(result).toEqual({
        movementEventId: "ME1",
        studentId: "S1",
        newState: "IN_HOSTEL",
      });
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "S1",
          fromState: "CHECKED_OUT",
          toState: "IN_HOSTEL",
          eventType: "MANUAL_RETURN",
          movementMethod: "MANUAL",
          recordedBy: "U1",
          isManualOverride: true,
          overrideReason: "Security override",
          dbClient: expect.any(Object),
        })
      );
    });

    it("records movement from OUTSIDE_HOSTEL to IN_HOSTEL", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "OUTSIDE_HOSTEL",
      });

      await manualReturn({
        studentId: "S1",
        recordedBy: "U1",
      });

      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: "OUTSIDE_HOSTEL",
          toState: "IN_HOSTEL",
        })
      );
    });

    it("records movement from OVERDUE to IN_HOSTEL", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "OVERDUE",
      });

      await manualReturn({
        studentId: "S1",
        recordedBy: "U1",
      });

      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: "OVERDUE",
          toState: "IN_HOSTEL",
        })
      );
    });
  });

  describe("transaction atomicity", () => {
    it("performs recordMovement in transaction", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "CHECKED_OUT",
      });

      await manualReturn({ studentId: "S1", recordedBy: "U1" });

      expect(mockRecordMovement).toHaveBeenCalledTimes(1);
    });

    it("propagates recordMovement failure", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "CHECKED_OUT",
      });
      mockRecordMovement.mockRejectedValue(
        new ConflictError("Student state mismatch")
      );

      await expect(
        manualReturn({ studentId: "S1", recordedBy: "U1" })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
});
