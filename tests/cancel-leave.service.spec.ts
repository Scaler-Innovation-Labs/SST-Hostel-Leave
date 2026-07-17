// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const tx: Record<string, any> = {};
  tx.insert = vi.fn(() => tx);
  tx.select = vi.fn(() => tx);
  tx.update = vi.fn(() => tx);
  tx.delete = vi.fn(() => tx);
  tx.from = vi.fn(() => tx);
  tx.where = vi.fn(() => tx);
  tx.values = vi.fn(() => tx);
  tx.set = vi.fn(() => tx);
  tx.returning = vi.fn().mockResolvedValue([]);
  tx.limit = vi.fn(() => tx);
  tx.orderBy = vi.fn(() => tx);
  tx.offset = vi.fn(() => tx);
  tx.innerJoin = vi.fn(() => tx);
  tx.leftJoin = vi.fn(() => tx);
  tx.$dynamic = vi.fn(() => tx);
  return {
    db: {
      transaction: (cb: any) => cb(tx),
      ...tx,
    },
  };
});

const mockFindById = vi.fn();
const mockFindByIdForUpdate = vi.fn();
const mockUpdateById = vi.fn();
const mockAuditRecord = vi.fn();
const mockRecordMovement = vi.fn();
const mockFindStudentById = vi.fn();
const mockFindQrPassByLeaveRequestId = vi.fn();
const mockInvalidateQr = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    updateDecisionByLeaveRequestId: (...args: any[]) => mockUpdateById(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: (...args: any[]) => mockFindStudentById(...args),
  },
}));

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findByLeaveRequestId: (...args: any[]) => mockFindQrPassByLeaveRequestId(...args),
    invalidate: (...args: any[]) => mockInvalidateQr(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

vi.mock("@/services/movement/record-movement.service", () => ({
  recordMovement: (...args: any[]) => mockRecordMovement(...args),
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: vi.fn().mockResolvedValue(undefined),
    publishMany: vi.fn().mockResolvedValue(undefined),
  },
}));

import { cancelLeave } from "@/services/leave/cancel-leave.service";
import { ConflictError, NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mockAuditRecord.mockResolvedValue({});
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
  mockInvalidateQr.mockResolvedValue({});
});

describe("cancelLeave service", () => {
  it("cancels a PENDING leave", async () => {
    mockFindById.mockResolvedValue({ id: "L1", status: "PENDING", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L1", status: "PENDING", studentId: "S1" });
    mockUpdateById.mockResolvedValue({ id: "L1", status: "CANCELLED" });

    const result = await cancelLeave("L1", { reason: "Changed plans" }, { id: "U1" });

    expect(result).toEqual({
      leaveId: "L1",
      newStatus: "CANCELLED",
      qrInvalidated: false,
    });
    expect(mockUpdateById).toHaveBeenCalledWith(
      "L1",
      expect.objectContaining({ status: "CANCELLED", cancelledAt: expect.any(Date) }),
      expect.any(Object)
    );
    expect(mockRecordMovement).not.toHaveBeenCalled();
    expect(mockInvalidateQr).not.toHaveBeenCalled();
  });

  it("cancels an APPROVED leave when student is IN_HOSTEL", async () => {
    mockFindById.mockResolvedValue({ id: "L2", status: "APPROVED", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L2", status: "APPROVED", studentId: "S1" });
    mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "IN_HOSTEL" });
    mockFindQrPassByLeaveRequestId.mockResolvedValue({ id: "QR1", status: "ACTIVE" });
    mockUpdateById.mockResolvedValue({ id: "L2", status: "CANCELLED" });

    const result = await cancelLeave("L2", {}, { id: "U1" });

    expect(result).toEqual({
      leaveId: "L2",
      newStatus: "CANCELLED",
      qrInvalidated: true,
    });
    expect(mockInvalidateQr).toHaveBeenCalledWith("QR1", expect.any(Object));
    expect(mockRecordMovement).not.toHaveBeenCalled();
  });

  it("cancels an APPROVED leave when student is APPROVED_LEAVE (before exit)", async () => {
    mockFindById.mockResolvedValue({ id: "L3", status: "APPROVED", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L3", status: "APPROVED", studentId: "S1" });
    mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "APPROVED_LEAVE" });
    mockFindQrPassByLeaveRequestId.mockResolvedValue(null);
    mockUpdateById.mockResolvedValue({ id: "L3", status: "CANCELLED" });

    const result = await cancelLeave("L3", {}, { id: "U1" });

    expect(result).toEqual({
      leaveId: "L3",
      newStatus: "CANCELLED",
      qrInvalidated: false,
    });
    expect(mockRecordMovement).not.toHaveBeenCalled();
  });

  it("blocks cancel when student has CHECKED_OUT", async () => {
    mockFindById.mockResolvedValue({ id: "L4", status: "APPROVED", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L4", status: "APPROVED", studentId: "S1" });
    mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "CHECKED_OUT" });

    await expect(
      cancelLeave("L4", {}, { id: "U1" })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("blocks cancel when student has OUTSIDE_HOSTEL", async () => {
    mockFindById.mockResolvedValue({ id: "L5", status: "APPROVED", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L5", status: "APPROVED", studentId: "S1" });
    mockFindStudentById.mockResolvedValue({ id: "S1", currentLocationState: "OUTSIDE_HOSTEL" });

    await expect(
      cancelLeave("L5", {}, { id: "U1" })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("cannot cancel REJECTED leave", async () => {
    mockFindById.mockResolvedValue({ id: "L6", status: "REJECTED" });

    await expect(
      cancelLeave("L6", {}, { id: "U1" })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("cannot cancel CANCELLED leave", async () => {
    mockFindById.mockResolvedValue({ id: "L7", status: "CANCELLED" });

    await expect(
      cancelLeave("L7", {}, { id: "U1" })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("cannot cancel COMPLETED leave", async () => {
    mockFindById.mockResolvedValue({ id: "L8", status: "COMPLETED" });

    await expect(
      cancelLeave("L8", {}, { id: "U1" })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws NotFoundError when leave does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(
      cancelLeave("NONEXISTENT", {}, { id: "U1" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("records audit on cancel", async () => {
    mockFindById.mockResolvedValue({ id: "L9", status: "PENDING", studentId: "S1" });
    mockFindByIdForUpdate.mockResolvedValue({ id: "L9", status: "PENDING", studentId: "S1" });
    mockUpdateById.mockResolvedValue({ id: "L9", status: "CANCELLED" });

    await cancelLeave("L9", { reason: "Personal" }, { id: "U1" });

    expect(mockAuditRecord).toHaveBeenCalledWith(
      "CANCEL",
      "LEAVE_REQUEST",
      "L9",
      "U1",
      expect.objectContaining({
        oldStatus: "PENDING",
        newStatus: "CANCELLED",
        reason: "Personal",
      }),
      expect.any(Object)
    );
  });
});
