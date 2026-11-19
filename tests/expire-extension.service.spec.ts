import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindById = vi.fn();
const mockFindByIdForUpdate = vi.fn();
const mockUpdateById = vi.fn();
const mockFindExpiredPendingExtensions = vi.fn();

vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockUpdateById(...args),
    findExpiredPendingExtensions: (...args: any[]) =>
      mockFindExpiredPendingExtensions(...args),
  },
}));

const mockFindByEntityAndDecision = vi.fn();
const mockUpdateDecisionById = vi.fn();

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findByEntityAndDecision: (...args: any[]) =>
      mockFindByEntityAndDecision(...args),
    updateDecisionById: (...args: any[]) => mockUpdateDecisionById(...args),
  },
}));

const mockAuditRecord = vi.fn();
vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockAuditRecord(...args),
  },
}));

const mockOutboxPublish = vi.fn();
vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: (...args: any[]) => mockOutboxPublish(...args),
  },
}));

vi.mock("@/lib/db", () => {
  const tx: Record<string, any> = {};
  tx.insert = vi.fn(() => tx);
  tx.select = vi.fn(() => tx);
  tx.update = vi.fn(() => tx);
  tx.delete = vi.fn(() => tx);
  return {
    db: {
      transaction: (cb: any) => cb(tx),
      ...tx,
    },
  };
});

import { systemActor } from "@/constants/audit/actor";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { ConflictError, NotFoundError } from "@/lib/errors";
import {
  expireSingleExtension,
  expireOverdueExtensions,
} from "@/services/leave/expire-extension.service";

const SYSTEM_ACTOR = systemActor("expire-leaves");

describe("expire-extension.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditRecord.mockResolvedValue({});
    mockOutboxPublish.mockResolvedValue(undefined);
    mockFindByEntityAndDecision.mockResolvedValue([]);
    mockUpdateDecisionById.mockResolvedValue(undefined);
    mockUpdateById.mockResolvedValue(undefined);
  });

  describe("expireSingleExtension", () => {
    it("successfully expires/rejects a pending extension and its pending approval steps", async () => {
      const pendingExt = {
        id: "EXT-101",
        leaveRequestId: "LR-501",
        status: LEAVE_REQUEST_STATUS.PENDING,
      };

      mockFindById.mockResolvedValue(pendingExt);
      mockFindByIdForUpdate.mockResolvedValue(pendingExt);
      mockFindByEntityAndDecision.mockResolvedValue([
        { id: "APPR-1", decision: LEAVE_APPROVAL_DECISION.PENDING },
      ]);

      const result = await expireSingleExtension(
        "EXT-101",
        SYSTEM_ACTOR,
        "Parent approval link expired without response"
      );

      expect(result).toEqual({
        extensionId: "EXT-101",
        leaveRequestId: "LR-501",
        newStatus: LEAVE_REQUEST_STATUS.REJECTED,
        expiredAt: expect.any(Date),
      });

      expect(mockUpdateDecisionById).toHaveBeenCalledWith(
        "APPR-1",
        LEAVE_APPROVAL_DECISION.REJECTED,
        null,
        "Parent approval link expired without response",
        expect.any(Date),
        expect.anything()
      );

      expect(mockUpdateById).toHaveBeenCalledWith(
        "EXT-101",
        expect.objectContaining({
          status: LEAVE_REQUEST_STATUS.REJECTED,
          currentStepKey: null,
          currentStepOrder: null,
          rejectedAt: expect.any(Date),
        }),
        expect.anything()
      );

      expect(mockAuditRecord).toHaveBeenCalledWith(
        AUDIT_ACTION.REJECT,
        AUDIT_ENTITY_TYPE.LEAVE_EXTENSION,
        "EXT-101",
        null,
        expect.objectContaining({
          oldStatus: LEAVE_REQUEST_STATUS.PENDING,
          newStatus: LEAVE_REQUEST_STATUS.REJECTED,
          reason: "Parent approval link expired without response",
        }),
        expect.anything()
      );

      expect(mockOutboxPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: OUTBOX_EVENT_TYPE.LEAVE_EXTENSION_REJECTED,
          aggregateId: "EXT-101",
          payload: expect.objectContaining({
            leaveId: "LR-501",
            extensionId: "EXT-101",
            decision: LEAVE_APPROVAL_DECISION.REJECTED,
          }),
        }),
        expect.anything()
      );
    });

    it("throws NotFoundError if extension does not exist", async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        expireSingleExtension("EXT-NOT-FOUND", SYSTEM_ACTOR)
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError if extension is not in PENDING status", async () => {
      mockFindById.mockResolvedValue({
        id: "EXT-102",
        status: LEAVE_REQUEST_STATUS.APPROVED,
      });

      await expect(
        expireSingleExtension("EXT-102", SYSTEM_ACTOR)
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("expireOverdueExtensions", () => {
    it("expires all expired pending extensions found by repository", async () => {
      const expiredExts = [
        { id: "EXT-1", leaveRequestId: "LR-1", status: LEAVE_REQUEST_STATUS.PENDING },
        { id: "EXT-2", leaveRequestId: "LR-2", status: LEAVE_REQUEST_STATUS.PENDING },
      ];

      mockFindExpiredPendingExtensions.mockResolvedValue(expiredExts);
      mockFindById.mockImplementation(async (id: string) => {
        return expiredExts.find((e) => e.id === id) ?? null;
      });
      mockFindByIdForUpdate.mockImplementation(async (id: string) => {
        return expiredExts.find((e) => e.id === id) ?? null;
      });

      const res = await expireOverdueExtensions(SYSTEM_ACTOR);

      expect(res.total).toBe(2);
      expect(res.expired).toBe(2);
      expect(res.skipped).toBe(0);
      expect(res.errors).toHaveLength(0);
      expect(mockUpdateById).toHaveBeenCalledTimes(2);
    });

    it("gracefully increments skipped counter on ConflictError", async () => {
      const expiredExts = [
        { id: "EXT-1", leaveRequestId: "LR-1", status: LEAVE_REQUEST_STATUS.PENDING },
      ];

      mockFindExpiredPendingExtensions.mockResolvedValue(expiredExts);
      // Already modified / approved concurrently
      mockFindById.mockResolvedValue({
        id: "EXT-1",
        status: LEAVE_REQUEST_STATUS.APPROVED,
      });

      const res = await expireOverdueExtensions(SYSTEM_ACTOR);

      expect(res.total).toBe(1);
      expect(res.expired).toBe(0);
      expect(res.skipped).toBe(1);
      expect(res.errors).toHaveLength(0);
    });

    it("collects errors when single expiry fails unexpectedly", async () => {
      mockFindExpiredPendingExtensions.mockResolvedValue([
        { id: "EXT-ERR", leaveRequestId: "LR-ERR", status: LEAVE_REQUEST_STATUS.PENDING },
      ]);
      mockFindById.mockRejectedValue(new Error("DB failure on select"));

      const res = await expireOverdueExtensions(SYSTEM_ACTOR);

      expect(res.total).toBe(1);
      expect(res.expired).toBe(0);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0]).toContain("DB failure on select");
    });
  });
});
