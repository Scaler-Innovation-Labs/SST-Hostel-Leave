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

import { manualCheckout } from "@/services/movement/manual-checkout.service";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";

const SUPER_ADMIN_USER = { id: "U1", roles: ["SUPER_ADMIN"] };

beforeEach(() => {
  vi.resetAllMocks();
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
  mockStudentFindByIdWithRelations.mockResolvedValue(null);
});

describe("manualCheckout service", () => {
  describe("precondition validation", () => {
    it("throws NotFoundError when student does not exist", async () => {
      mockStudentFindById.mockResolvedValue(null);

      await expect(
        manualCheckout({ studentId: "NONEXISTENT", currentUser: SUPER_ADMIN_USER })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws ConflictError when student is CHECKED_OUT", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "CHECKED_OUT",
      });

      await expect(
        manualCheckout({ studentId: "S1", currentUser: SUPER_ADMIN_USER })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("throws ConflictError when student is OUTSIDE_HOSTEL", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "OUTSIDE_HOSTEL",
      });

      await expect(
        manualCheckout({ studentId: "S1", currentUser: SUPER_ADMIN_USER })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("throws ConflictError when student is OVERDUE", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "OVERDUE",
      });

      await expect(
        manualCheckout({ studentId: "S1", currentUser: SUPER_ADMIN_USER })
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
        currentUser: SUPER_ADMIN_USER,
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

    it("rejects manual checkout from APPROVED_LEAVE (legacy state, contract T2)", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "APPROVED_LEAVE",
      });

      await expect(
        manualCheckout({
          studentId: "S1",
          currentUser: SUPER_ADMIN_USER,
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("passes leaveRequestId when provided", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "IN_HOSTEL",
      });

      await manualCheckout({
        studentId: "S1",
        leaveRequestId: "LR1",
        currentUser: SUPER_ADMIN_USER,
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

      await manualCheckout({ studentId: "S1", currentUser: SUPER_ADMIN_USER });

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
        manualCheckout({ studentId: "S1", currentUser: SUPER_ADMIN_USER })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("hostel-scope enforcement", () => {
    it("rejects a hostel-scoped admin acting outside their hostels", async () => {
      mockStudentFindById.mockResolvedValue({
        id: "S1",
        currentLocationState: "IN_HOSTEL",
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
        manualCheckout({ studentId: "S1", currentUser: scopedAdmin })
      ).rejects.toBeInstanceOf(AuthorizationError);
      expect(mockRecordMovement).not.toHaveBeenCalled();
    });
  });
});
