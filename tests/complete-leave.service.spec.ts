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
const mockPublish = vi.fn();
const mockFindStudentByUserId = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockFindStudentByUserId(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: (...args: any[]) => mockPublish(...args),
  },
}));

import { completeLeave } from "@/services/leave/complete-leave.service";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";

const STUDENT_USER = { id: "U1", roles: ["STUDENT"] };
const OTHER_STUDENT_USER = { id: "U2", roles: ["STUDENT"] };

const APPROVED_LEAVE = {
  id: "L1",
  studentId: "S1",
  status: "APPROVED",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindById.mockResolvedValue(APPROVED_LEAVE);
  mockFindByIdForUpdate.mockResolvedValue({
    ...APPROVED_LEAVE,
    status: "APPROVED",
  });
  mockUpdateById.mockResolvedValue({});
  mockAuditRecord.mockResolvedValue({});
  mockPublish.mockResolvedValue({});
  mockFindStudentByUserId.mockImplementation((userId: string) => ({
    id: userId === "U1" ? "S1" : "S2",
    userId,
  }));
});

describe("completeLeave service", () => {
  it("completes the student's own leave", async () => {
    const result = await completeLeave("L1", { actualReturnAt: undefined }, STUDENT_USER);

    expect(result.newStatus).toBe("COMPLETED");
    expect(mockUpdateById).toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LEAVE_COMPLETED" }),
      expect.any(Object)
    );
  });

  it("rejects completing another student's leave (IDOR guard)", async () => {
    await expect(
      completeLeave("L1", { actualReturnAt: undefined }, OTHER_STUDENT_USER)
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(mockUpdateById).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the leave does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(
      completeLeave("L1", { actualReturnAt: undefined }, STUDENT_USER)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError when the leave status cannot be completed", async () => {
    mockFindById.mockResolvedValue({ ...APPROVED_LEAVE, status: "PENDING" });
    mockFindByIdForUpdate.mockResolvedValue({ ...APPROVED_LEAVE, status: "PENDING" });

    await expect(
      completeLeave("L1", { actualReturnAt: undefined }, STUDENT_USER)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("allows staff to complete a leave within scope", async () => {
    const result = await completeLeave(
      "L1",
      { actualReturnAt: "2026-06-12T00:00:00Z" },
      { id: "U9", roles: ["ADMIN"] }
    );

    expect(result.newStatus).toBe("COMPLETED");
    expect(mockUpdateById).toHaveBeenCalledWith(
      "L1",
      expect.objectContaining({
        actualReturnAt: new Date("2026-06-12T00:00:00Z"),
      }),
      expect.any(Object)
    );
  });
});
