// @ts-nocheck
import crypto from "crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

const mockLeaveFindById = vi.fn();
const mockLeaveFindByIdForUpdate = vi.fn();
const mockLeaveFindByIdWithRelations = vi.fn();
const mockLeaveUpdateById = vi.fn();
const mockFindExpiredLeaves = vi.fn();
const mockFindLeavesWithExpiredParentApproval = vi.fn();
const mockHasExpiredParentApproval = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockLeaveFindByIdForUpdate(...args),
    findByIdWithRelations: (...args: any[]) => mockLeaveFindByIdWithRelations(...args),
    updateById: (...args: any[]) => mockLeaveUpdateById(...args),
    findExpiredLeaves: (...args: any[]) => mockFindExpiredLeaves(...args),
    findLeavesWithExpiredParentApproval: (...args: any[]) =>
      mockFindLeavesWithExpiredParentApproval(...args),
    hasExpiredParentApproval: (...args: any[]) =>
      mockHasExpiredParentApproval(...args),
  },
}));

const mockUpdateDecisionByLeaveRequestId = vi.fn().mockResolvedValue([]);
const mockUpdateDecisionById = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    updateDecisionByLeaveRequestId: (...args: any[]) =>
      mockUpdateDecisionByLeaveRequestId(...args),
    updateDecisionById: (...args: any[]) => mockUpdateDecisionById(...args),
  },
}));

const mockFindByParentApprovalToken = vi.fn();
const mockUpdateParentDecision = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db/repositories/leave/leave-parent-approval.repository", () => ({
  leaveParentApprovalRepository: {
    findByParentApprovalToken: (...args: any[]) =>
      mockFindByParentApprovalToken(...args),
    updateParentDecision: (...args: any[]) =>
      mockUpdateParentDecision(...args),
  },
}));

const mockQrFindByLeaveRequestId = vi.fn().mockResolvedValue(null);
const mockQrInvalidate = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findByLeaveRequestId: (...args: any[]) =>
      mockQrFindByLeaveRequestId(...args),
    invalidate: (...args: any[]) => mockQrInvalidate(...args),
  },
}));

const mockAuditRecord = vi.fn().mockResolvedValue({});
vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

const mockOutboxPublish = vi.fn().mockResolvedValue(undefined);
vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: (...args: any[]) => mockOutboxPublish(...args),
    publishMany: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockAssertCanAccessLeave = vi.fn().mockResolvedValue(undefined);
vi.mock("@/services/shared/authorization.service", () => ({
  assertCanAccessLeave: (...args: any[]) => mockAssertCanAccessLeave(...args),
}));

vi.mock("@/lib/db", () => {
  const tx: any = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    $dynamic: vi.fn().mockReturnThis(),
  };
  return {
    db: {
      transaction: (cb: any) => cb(tx),
      ...tx,
    },
  };
});

import { systemActor } from "@/constants/audit/actor";
import { GENERIC_PARENT_TOKEN_ERROR_MESSAGE } from "@/constants/parent/parent-approval";
import { ValidationError } from "@/lib/errors";
import { expireOverdueLeaves, expireSingleLeave } from "@/services/leave/expire-leave.service";
import { getLeave } from "@/services/leave/get-leave.service";
import { getLeaveDetailsByToken } from "@/services/parent/get-leave-details-by-token.service";
import { parentApproveDecision } from "@/services/parent/parent-approve-decision.service";

describe("Expired Parent Approval to Leave Expiration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditRecord.mockResolvedValue({});
    mockOutboxPublish.mockResolvedValue(undefined);
    mockAssertCanAccessLeave.mockResolvedValue(undefined);
    mockQrFindByLeaveRequestId.mockResolvedValue(null);
  });

  describe("expireOverdueLeaves batch job", () => {
    it("expires leaves returned by findLeavesWithExpiredParentApproval", async () => {
      // No endAt-expired leaves
      mockFindExpiredLeaves.mockResolvedValue([]);
      // 2 leaves with expired parent approvals
      mockFindLeavesWithExpiredParentApproval.mockResolvedValueOnce([
        { id: "LR-P1", status: "PENDING", studentId: "S1" },
        { id: "LR-P2", status: "PENDING", studentId: "S2" },
      ]).mockResolvedValueOnce([]); // Second batch empty

      mockLeaveFindById.mockImplementation((id) =>
        Promise.resolve({ id, status: "PENDING", studentId: "S1" })
      );
      mockLeaveFindByIdForUpdate.mockImplementation((id) =>
        Promise.resolve({ id, status: "PENDING", studentId: "S1" })
      );
      mockLeaveUpdateById.mockResolvedValue({ status: "EXPIRED" });

      const result = await expireOverdueLeaves(systemActor("expire-leaves"));

      expect(result.total).toBe(2);
      expect(result.expired).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verified leave status updated to EXPIRED
      expect(mockLeaveUpdateById).toHaveBeenCalledWith(
        "LR-P1",
        expect.objectContaining({
          status: "EXPIRED",
          currentStepKey: null,
          currentStepOrder: null,
        }),
        expect.anything()
      );
      // Verified pending approvals cancelled
      expect(mockUpdateDecisionByLeaveRequestId).toHaveBeenCalledWith(
        "LR-P1",
        "CANCELLED",
        expect.any(Date),
        expect.anything()
      );
      // Verified outbox event published
      expect(mockOutboxPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "LEAVE_EXPIRED",
          aggregateId: "LR-P1",
        }),
        expect.anything()
      );
    });
  });

  describe("getLeave service auto-expiry", () => {
    it("auto-expires pending leave if parent approval has expired with no action", async () => {
      const pendingLeave = {
        id: "LR-101",
        status: "PENDING",
        studentId: "S1",
      };
      const expiredLeave = {
        id: "LR-101",
        status: "EXPIRED",
        studentId: "S1",
      };

      mockLeaveFindByIdWithRelations
        .mockResolvedValueOnce({
          leave: pendingLeave,
          student: { id: "S1" },
          user: { fullName: "Test Student" },
          leaveType: { name: "Home Leave" },
        })
        .mockResolvedValueOnce({
          leave: expiredLeave,
          student: { id: "S1" },
          user: { fullName: "Test Student" },
          leaveType: { name: "Home Leave" },
        });

      mockHasExpiredParentApproval.mockResolvedValue(true);
      mockLeaveFindById.mockResolvedValue(pendingLeave);
      mockLeaveFindByIdForUpdate.mockResolvedValue(pendingLeave);
      mockLeaveUpdateById.mockResolvedValue(expiredLeave);

      const currentUser = { id: "U1", role: "STUDENT" };
      const res = await getLeave("LR-101", currentUser as any);

      expect(mockHasExpiredParentApproval).toHaveBeenCalledWith("LR-101");
      expect(mockLeaveUpdateById).toHaveBeenCalledWith(
        "LR-101",
        expect.objectContaining({ status: "EXPIRED" }),
        expect.anything()
      );
      expect(res.leave.status).toBe("EXPIRED");
    });

    it("does not auto-expire if parent approval has not expired", async () => {
      const pendingLeave = {
        id: "LR-102",
        status: "PENDING",
        studentId: "S1",
      };

      mockLeaveFindByIdWithRelations.mockResolvedValue({
        leave: pendingLeave,
        student: { id: "S1" },
        user: { fullName: "Test Student" },
        leaveType: { name: "Home Leave" },
      });
      mockHasExpiredParentApproval.mockResolvedValue(false);

      const currentUser = { id: "U1", role: "STUDENT" };
      const res = await getLeave("LR-102", currentUser as any);

      expect(mockHasExpiredParentApproval).toHaveBeenCalledWith("LR-102");
      expect(mockLeaveUpdateById).not.toHaveBeenCalled();
      expect(res.leave.status).toBe("PENDING");
    });
  });

  describe("getLeaveDetailsByToken", () => {
    it("expires leave when link expired and no action taken, then throws generic ValidationError", async () => {
      const rawToken = "raw-expired-token-1";
      const tokenHash = sha256(rawToken);

      mockFindByParentApprovalToken.mockResolvedValue({
        id: "AP-1",
        leaveRequestId: "LR-201",
        decision: "PENDING",
        actedAt: null,
        parentDetails: {
          tokenExpiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        },
      });

      mockLeaveFindById.mockResolvedValue({
        id: "LR-201",
        status: "PENDING",
        studentId: "S1",
      });
      mockLeaveFindByIdForUpdate.mockResolvedValue({
        id: "LR-201",
        status: "PENDING",
        studentId: "S1",
      });
      mockLeaveUpdateById.mockResolvedValue({ status: "EXPIRED" });

      await expect(getLeaveDetailsByToken(rawToken)).rejects.toThrow(
        GENERIC_PARENT_TOKEN_ERROR_MESSAGE
      );

      // Verify leave was expired
      expect(mockLeaveUpdateById).toHaveBeenCalledWith(
        "LR-201",
        expect.objectContaining({ status: "EXPIRED" }),
        expect.anything()
      );
    });

    it("does not expire leave if parent had already approved or acted", async () => {
      const rawToken = "raw-acted-token";
      const tokenHash = sha256(rawToken);

      mockFindByParentApprovalToken.mockResolvedValue({
        id: "AP-2",
        leaveRequestId: "LR-202",
        decision: "APPROVED",
        actedAt: new Date(Date.now() - 7200000),
        parentDetails: {
          tokenExpiresAt: new Date(Date.now() - 3600000),
        },
      });

      await expect(getLeaveDetailsByToken(rawToken)).rejects.toThrow(
        GENERIC_PARENT_TOKEN_ERROR_MESSAGE
      );

      // Expiry should NOT have been called
      expect(mockLeaveUpdateById).not.toHaveBeenCalled();
    });
  });

  describe("parentApproveDecision", () => {
    it("expires leave when decision attempted on expired link with no action taken", async () => {
      const rawToken = "raw-expired-token-2";
      const tokenHash = sha256(rawToken);

      mockFindByParentApprovalToken.mockResolvedValue({
        id: "AP-3",
        leaveRequestId: "LR-301",
        decision: "PENDING",
        actedAt: null,
        parentDetails: {
          tokenExpiresAt: new Date(Date.now() - 3600000), // expired
        },
      });

      mockLeaveFindById.mockResolvedValue({
        id: "LR-301",
        status: "PENDING",
        studentId: "S1",
      });
      mockLeaveFindByIdForUpdate.mockResolvedValue({
        id: "LR-301",
        status: "PENDING",
        studentId: "S1",
      });
      mockLeaveUpdateById.mockResolvedValue({ status: "EXPIRED" });

      await expect(
        parentApproveDecision(rawToken, { decision: "APPROVED" })
      ).rejects.toThrow(GENERIC_PARENT_TOKEN_ERROR_MESSAGE);

      expect(mockLeaveUpdateById).toHaveBeenCalledWith(
        "LR-301",
        expect.objectContaining({ status: "EXPIRED" }),
        expect.anything()
      );
    });
  });
});
