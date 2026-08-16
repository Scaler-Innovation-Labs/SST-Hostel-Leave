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
const mockStudentFindByIdWithRelations = vi.fn();
const mockRecordMovement = vi.fn();

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: (...args: any[]) => mockStudentFindById(...args),
    findByIdWithRelations: (...args: any[]) => mockStudentFindByIdWithRelations(...args),
  },
}));

vi.mock("@/services/movement/record-movement.service", () => ({
  recordMovement: (...args: any[]) => mockRecordMovement(...args),
}));

import { markOverdue } from "@/services/movement/mark-overdue.service";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";

const OVERRIDE_USER = { id: "SYSTEM", roles: ["SUPER_ADMIN"] };

beforeEach(() => {
  vi.resetAllMocks();
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
  mockStudentFindByIdWithRelations.mockResolvedValue(null);
});

describe("markOverdue service", () => {
  describe("precondition validation", () => {
    it("throws NotFoundError when student does not exist", async () => {
      mockStudentFindById.mockResolvedValue(null);

      await expect(
        markOverdue({ studentId: "NONEXISTENT", currentUser: OVERRIDE_USER })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws ConflictError when student is IN_HOSTEL", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "IN_HOSTEL",
      });

      await expect(
        markOverdue({ studentId: "S1", currentUser: OVERRIDE_USER })
      ).rejects.toBeInstanceOf(ConflictError);
    });

  });

  describe("successful overdue marking", () => {
    it("marks CHECKED_OUT student as overdue", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "CHECKED_OUT",
      });

      const result = await markOverdue({
        studentId: "S1",
        currentUser: OVERRIDE_USER,
      });

      expect(result).toEqual({
        movementEventId: "ME1",
        studentId: "S1",
        newState: "OVERDUE",
      });
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "S1",
          fromState: "CHECKED_OUT",
          toState: "OVERDUE",
          eventType: "AUTO_OVERDUE",
          movementMethod: "SYSTEM",
          recordedBy: "SYSTEM",
          isManualOverride: true,
          dbClient: expect.any(Object),
        })
      );
    });

    it("marks OUTSIDE_HOSTEL student as overdue", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "OUTSIDE_HOSTEL",
      });

      await markOverdue({
        studentId: "S1",
        currentUser: OVERRIDE_USER,
      });

      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: "OUTSIDE_HOSTEL",
          toState: "OVERDUE",
        })
      );
    });

    it("rejects APPROVED_LEAVE student (legacy state, contract T2)", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "APPROVED_LEAVE",
      });

      await expect(
        markOverdue({ studentId: "S1", currentUser: OVERRIDE_USER })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("transaction atomicity", () => {
    it("performs recordMovement in transaction", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "CHECKED_OUT",
      });

      await markOverdue({ studentId: "S1", currentUser: OVERRIDE_USER });

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
        markOverdue({ studentId: "S1", currentUser: OVERRIDE_USER })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("hostel-scope enforcement", () => {
    it("rejects a hostel-scoped admin marking overdue a student from another hostel", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "CHECKED_OUT",
      });

      mockStudentFindByIdWithRelations.mockResolvedValue({
        student: { id: "S1" },
        user: { hostelId: "H2" },
        locationState: null,
      });

      const scopedAdmin = {
        id: "U9",
        roles: ["ADMIN"],
        roleScopes: [
          { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" },
        ],
      };

      await expect(
        markOverdue({ studentId: "S1", currentUser: scopedAdmin })
      ).rejects.toBeInstanceOf(AuthorizationError);
      expect(mockRecordMovement).not.toHaveBeenCalled();
    });
  });
});
