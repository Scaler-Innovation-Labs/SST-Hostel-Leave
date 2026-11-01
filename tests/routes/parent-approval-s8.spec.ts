// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";

const RAW_VALID_TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const RAW_EXPIRED_TOKEN = "b1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const RAW_USED_TOKEN = "c1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const RAW_UNKNOWN_TOKEN = "d1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

const VALID_TOKEN_HASH = "hash_valid";
const EXPIRED_TOKEN_HASH = "hash_expired";
const USED_TOKEN_HASH = "hash_used";
const UNKNOWN_TOKEN_HASH = "hash_unknown";

const mockRateLimit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/rate-limiter", () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
}));

const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerInfo = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: (...args: any[]) => mockLoggerWarn(...args),
    error: (...args: any[]) => mockLoggerError(...args),
    info: (...args: any[]) => mockLoggerInfo(...args),
  },
}));

vi.mock("@/lib/crypto", () => ({
  sha256: vi.fn(async (raw: string) => {
    if (raw === RAW_VALID_TOKEN) return VALID_TOKEN_HASH;
    if (raw === RAW_EXPIRED_TOKEN) return EXPIRED_TOKEN_HASH;
    if (raw === RAW_USED_TOKEN) return USED_TOKEN_HASH;
    if (raw === RAW_UNKNOWN_TOKEN) return UNKNOWN_TOKEN_HASH;
    return `hash_${raw}`;
  }),
}));

const mockFindByParentApprovalToken = vi.fn();
const mockUpdateParentDecision = vi.fn();
vi.mock("@/db/repositories/leave/leave-parent-approval.repository", () => ({
  leaveParentApprovalRepository: {
    findByParentApprovalToken: (...args: any[]) => mockFindByParentApprovalToken(...args),
    updateParentDecision: (...args: any[]) => mockUpdateParentDecision(...args),
  },
}));

const mockFindNextByEntityAndDecision = vi.fn().mockResolvedValue(null);
const mockFindByEntityAndDecision = vi.fn().mockResolvedValue([]);
const mockUpdateDecisionById = vi.fn().mockResolvedValue(undefined);
vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findNextByEntityAndDecision: (...args: any[]) => mockFindNextByEntityAndDecision(...args),
    findByEntityAndDecision: (...args: any[]) => mockFindByEntityAndDecision(...args),
    updateDecisionById: (...args: any[]) => mockUpdateDecisionById(...args),
  },
}));

const mockLeaveFindById = vi.fn();
const mockLeaveFindByIdForUpdate = vi.fn();
const mockLeaveUpdateById = vi.fn();
vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockLeaveFindById(...args),
    findByIdForUpdate: (...args: any[]) => mockLeaveFindByIdForUpdate(...args),
    updateById: (...args: any[]) => mockLeaveUpdateById(...args),
    updateCurrentStep: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockLeaveTypeFindById = vi.fn();
vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockLeaveTypeFindById(...args),
  },
}));

const mockParentFindById = vi.fn();
vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findById: (...args: any[]) => mockParentFindById(...args),
  },
}));

vi.mock("@/lib/db/transaction", () => ({
  transaction: vi.fn(async (cb: any) => cb({})),
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/services/leave/qr-pass-lifecycle.service", () => ({
  issueQrPassForApprovedLeave: vi.fn().mockResolvedValue(undefined),
  extendQrPassWindow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/workflow/workflow-activation.service", () => ({
  activateWorkflowStep: vi.fn().mockResolvedValue(undefined),
}));

import { GENERIC_PARENT_TOKEN_ERROR_MESSAGE } from "@/constants/parent/parent-approval";
import ParentApprovePage from "@/app/parent-approve/[token]/page";
import { POST as handleDecisionPost } from "@/app/api/parent-approve/[token]/decision/route";
import { TooManyRequestsError } from "@/lib/errors";

const MOCK_VALID_APPROVAL = {
  id: "approval-uuid-1",
  leaveRequestId: "leave-uuid-1",
  leaveExtensionId: null,
  decision: "PENDING",
  stepOrder: 1,
  stepKey: "PARENT_APPROVAL",
  studentName: "John Doe",
  studentRollNumber: "ROLL12345",
  parentDetails: {
    parentId: "parent-uuid-1",
    tokenHash: VALID_TOKEN_HASH,
    tokenExpiresAt: new Date(Date.now() + 86400000), // 24 hours in future
  },
  leaveRequest: {
    id: "leave-uuid-1",
    reason: "Going home for festival",
    startAt: new Date("2026-11-01T10:00:00Z"),
    endAt: new Date("2026-11-05T18:00:00Z"),
    status: "PENDING",
    submittedForm: null,
  },
  leaveExtension: null,
};

const MOCK_EXPIRED_APPROVAL = {
  id: "approval-uuid-2",
  leaveRequestId: "leave-uuid-2",
  leaveExtensionId: null,
  decision: "PENDING",
  stepOrder: 1,
  stepKey: "PARENT_APPROVAL",
  studentName: "Jane Smith",
  studentRollNumber: "ROLL67890",
  parentDetails: {
    parentId: "parent-uuid-2",
    tokenHash: EXPIRED_TOKEN_HASH,
    tokenExpiresAt: new Date(Date.now() - 3600000), // 1 hour ago
  },
  leaveRequest: {
    id: "leave-uuid-2",
    reason: "Medical emergency",
    startAt: new Date("2026-10-01T10:00:00Z"),
    endAt: new Date("2026-10-03T18:00:00Z"),
    status: "PENDING",
    submittedForm: null,
  },
  leaveExtension: null,
};

const MOCK_USED_APPROVAL = {
  id: "approval-uuid-3",
  leaveRequestId: "leave-uuid-3",
  leaveExtensionId: null,
  decision: "APPROVED",
  stepOrder: 1,
  stepKey: "PARENT_APPROVAL",
  studentName: "Alice Walker",
  studentRollNumber: "ROLL11223",
  parentDetails: {
    parentId: "parent-uuid-3",
    tokenHash: USED_TOKEN_HASH,
    tokenExpiresAt: new Date(Date.now() + 86400000),
  },
  leaveRequest: {
    id: "leave-uuid-3",
    reason: "Internship interview",
    startAt: new Date("2026-11-01T10:00:00Z"),
    endAt: new Date("2026-11-02T18:00:00Z"),
    status: "APPROVED",
    submittedForm: null,
  },
  leaveExtension: null,
};

const MOCK_PARENT = {
  id: "parent-uuid-1",
  name: "Robert Doe",
  phone: "+919876543210",
};

const MOCK_LEAVE_ROW = {
  id: "leave-uuid-1",
  studentId: "student-uuid-1",
  leaveTypeId: "type-uuid-1",
  status: "PENDING",
  currentStepKey: "PARENT_APPROVAL",
  currentStepOrder: 1,
  reason: "Going home for festival",
  startAt: new Date("2026-11-01T10:00:00Z"),
  endAt: new Date("2026-11-05T18:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindByParentApprovalToken.mockImplementation(async (hash: string) => {
    if (hash === VALID_TOKEN_HASH) return MOCK_VALID_APPROVAL;
    if (hash === EXPIRED_TOKEN_HASH) return MOCK_EXPIRED_APPROVAL;
    if (hash === USED_TOKEN_HASH) return MOCK_USED_APPROVAL;
    return null;
  });
  mockParentFindById.mockResolvedValue(MOCK_PARENT);
  mockLeaveFindById.mockResolvedValue(MOCK_LEAVE_ROW);
  mockLeaveFindByIdForUpdate.mockResolvedValue(MOCK_LEAVE_ROW);
  mockLeaveTypeFindById.mockResolvedValue({ id: "type-uuid-1", name: "Home Leave", description: "Regular home visit" });
  mockUpdateParentDecision.mockResolvedValue({ id: "approval-uuid-1", decision: "APPROVED" });
  mockLeaveUpdateById.mockResolvedValue({ id: "leave-uuid-1" });
  mockFindNextByEntityAndDecision.mockResolvedValue(null);
});

describe("S8 — Parent Approval Token Anti-Enumeration Hardening", () => {
  describe("VIEW: GET /parent-approve/[token]", () => {
    it("renders valid approval flow for a genuinely valid token", async () => {
      const pageJsx = await ParentApprovePage({
        params: Promise.resolve({ token: RAW_VALID_TOKEN }),
      });

      // Valid token returns the ParentApprovalFlow component with student details
      expect(pageJsx.props.token).toBe(RAW_VALID_TOKEN);
      expect(pageJsx.props.leaveData).toBeDefined();
      expect(pageJsx.props.leaveData.studentName).toBe("John Doe");
      expect(pageJsx.props.leaveData.studentRollNumber).toBe("ROLL12345");
      expect(pageJsx.props.leaveData.leaveReason).toBe("Going home for festival");
      expect(pageJsx.props.leaveData.parentName).toBe("Robert Doe");
    });

    it("renders generic error view for an unknown random token without leaking details", async () => {
      const pageJsx = await ParentApprovePage({
        params: Promise.resolve({ token: RAW_UNKNOWN_TOKEN }),
      });

      // Renders failure card
      const text = JSON.stringify(pageJsx);
      expect(text).toContain("Unable to process this approval link");
      expect(text).toContain("This link is invalid, expired, or has already been used");
      // Must not leak any sensitive domain data
      expect(text).not.toContain("John Doe");
      expect(text).not.toContain("ROLL12345");
      expect(text).not.toContain("+919876543210");
      expect(text).not.toContain("leave-uuid-1");
    });

    it("renders identical generic error view for an expired token without leaking details", async () => {
      const pageJsx = await ParentApprovePage({
        params: Promise.resolve({ token: RAW_EXPIRED_TOKEN }),
      });

      const text = JSON.stringify(pageJsx);
      expect(text).toContain("Unable to process this approval link");
      expect(text).toContain("This link is invalid, expired, or has already been used");
      expect(text).not.toContain("Jane Smith");
      expect(text).not.toContain("ROLL67890");
      expect(text).not.toContain("leave-uuid-2");
    });

    it("renders identical generic error view for an already-used/revoked token without leaking details", async () => {
      const pageJsx = await ParentApprovePage({
        params: Promise.resolve({ token: RAW_USED_TOKEN }),
      });

      const text = JSON.stringify(pageJsx);
      expect(text).toContain("Unable to process this approval link");
      expect(text).toContain("This link is invalid, expired, or has already been used");
      expect(text).not.toContain("Alice Walker");
      expect(text).not.toContain("ROLL11223");
      expect(text).not.toContain("leave-uuid-3");
    });

    it("renders identical generic error view for malformed or empty token", async () => {
      const pageJsx = await ParentApprovePage({
        params: Promise.resolve({ token: "   " }),
      });

      const text = JSON.stringify(pageJsx);
      expect(text).toContain("Unable to process this approval link");
      expect(text).toContain("This link is invalid, expired, or has already been used");
    });

    it("renders identical generic error view when rate limited", async () => {
      mockRateLimit.mockRejectedValueOnce(new TooManyRequestsError("Too many attempts", 900));

      const pageJsx = await ParentApprovePage({
        params: Promise.resolve({ token: RAW_VALID_TOKEN }),
      });

      const text = JSON.stringify(pageJsx);
      expect(text).toContain("Unable to process this approval link");
      expect(text).toContain("This link is invalid, expired, or has already been used");
    });
  });

  describe("DECISION: POST /api/parent-approve/[token]/decision", () => {
    it("successfully approves when token is valid", async () => {
      const req = new Request(`http://localhost/api/parent-approve/${RAW_VALID_TOKEN}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVED", comments: "All good" }),
      });

      const res = await handleDecisionPost(req, {
        params: Promise.resolve({ token: RAW_VALID_TOKEN }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.approvalId).toBe("approval-uuid-1");
      expect(data.data.decision).toBe("APPROVED");
    });

    it("successfully rejects when token is valid", async () => {
      mockUpdateParentDecision.mockResolvedValueOnce({ id: "approval-uuid-1", decision: "REJECTED" });
      const req = new Request(`http://localhost/api/parent-approve/${RAW_VALID_TOKEN}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "REJECTED", comments: "Not permitted" }),
      });

      const res = await handleDecisionPost(req, {
        params: Promise.resolve({ token: RAW_VALID_TOKEN }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.approvalId).toBe("approval-uuid-1");
      expect(data.data.decision).toBe("REJECTED");
    });

    it("returns generic 400 for an unknown random token", async () => {
      const req = new Request(`http://localhost/api/parent-approve/${RAW_UNKNOWN_TOKEN}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVED" }),
      });

      const res = await handleDecisionPost(req, {
        params: Promise.resolve({ token: RAW_UNKNOWN_TOKEN }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe(GENERIC_PARENT_TOKEN_ERROR_MESSAGE);
    });

    it("returns generic 400 for an expired token", async () => {
      const req = new Request(`http://localhost/api/parent-approve/${RAW_EXPIRED_TOKEN}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVED" }),
      });

      const res = await handleDecisionPost(req, {
        params: Promise.resolve({ token: RAW_EXPIRED_TOKEN }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe(GENERIC_PARENT_TOKEN_ERROR_MESSAGE);
    });

    it("returns generic 400 for an already-used/revoked token (repeated decision)", async () => {
      const req = new Request(`http://localhost/api/parent-approve/${RAW_USED_TOKEN}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVED" }),
      });

      const res = await handleDecisionPost(req, {
        params: Promise.resolve({ token: RAW_USED_TOKEN }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe(GENERIC_PARENT_TOKEN_ERROR_MESSAGE);
    });

    it("returns generic 400 for a malformed / whitespace token", async () => {
      const req = new Request(`http://localhost/api/parent-approve/%20%20/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVED" }),
      });

      const res = await handleDecisionPost(req, {
        params: Promise.resolve({ token: "   " }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe(GENERIC_PARENT_TOKEN_ERROR_MESSAGE);
    });

    it("proves anti-enumeration oracle resistance: invalid, expired, used, and malformed tokens return byte-identical responses", async () => {
      const makeCall = async (token: string) => {
        const req = new Request(`http://localhost/api/parent-approve/${encodeURIComponent(token)}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "APPROVED" }),
        });
        const res = await handleDecisionPost(req, {
          params: Promise.resolve({ token }),
        });
        return {
          status: res.status,
          json: await res.json(),
        };
      };

      const resUnknown = await makeCall(RAW_UNKNOWN_TOKEN);
      const resExpired = await makeCall(RAW_EXPIRED_TOKEN);
      const resUsed = await makeCall(RAW_USED_TOKEN);
      const resMalformed = await makeCall("   ");

      // Verify all 4 return identical status code
      expect(resUnknown.status).toBe(400);
      expect(resExpired.status).toBe(400);
      expect(resUsed.status).toBe(400);
      expect(resMalformed.status).toBe(400);

      // Verify all 4 return identical JSON error payload
      expect(resUnknown.json).toEqual(resExpired.json);
      expect(resUnknown.json).toEqual(resUsed.json);
      expect(resUnknown.json).toEqual(resMalformed.json);

      // Verify error contains no internal leaks
      expect(resUnknown.json.error.message).toBe(GENERIC_PARENT_TOKEN_ERROR_MESSAGE);
      expect(JSON.stringify(resUnknown.json)).not.toContain("John");
      expect(JSON.stringify(resUnknown.json)).not.toContain("Jane");
      expect(JSON.stringify(resUnknown.json)).not.toContain("Alice");
      expect(JSON.stringify(resUnknown.json)).not.toContain("uuid");
      expect(JSON.stringify(resUnknown.json)).not.toContain("not found");
      expect(JSON.stringify(resUnknown.json)).not.toContain("already processed");
      expect(JSON.stringify(resUnknown.json)).not.toContain("link has expired");
    });

    it("returns validation error for invalid decision enum", async () => {
      const req = new Request(`http://localhost/api/parent-approve/${RAW_VALID_TOKEN}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "MAYBE" }),
      });

      const res = await handleDecisionPost(req, {
        params: Promise.resolve({ token: RAW_VALID_TOKEN }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("decision");
    });

    it("returns validation error for malformed JSON request body", async () => {
      const req = new Request(`http://localhost/api/parent-approve/${RAW_VALID_TOKEN}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ not valid json ",
      });

      const res = await handleDecisionPost(req, {
        params: Promise.resolve({ token: RAW_VALID_TOKEN }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("JSON");
    });

    it("handles concurrent update race with generic response", async () => {
      mockUpdateParentDecision.mockResolvedValueOnce(null);

      const req = new Request(`http://localhost/api/parent-approve/${RAW_VALID_TOKEN}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVED" }),
      });

      const res = await handleDecisionPost(req, {
        params: Promise.resolve({ token: RAW_VALID_TOKEN }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe(GENERIC_PARENT_TOKEN_ERROR_MESSAGE);
    });

    it("preserves legitimate business conflict when valid token encounters non-pending leave", async () => {
      mockLeaveFindByIdForUpdate.mockResolvedValueOnce({
        ...MOCK_LEAVE_ROW,
        status: "REJECTED",
      });

      const req = new Request(`http://localhost/api/parent-approve/${RAW_VALID_TOKEN}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVED" }),
      });

      const res = await handleDecisionPost(req, {
        params: Promise.resolve({ token: RAW_VALID_TOKEN }),
      });
      const body = await res.json();

      // For valid token, business conflict (e.g. staff already acted) is preserved
      expect(res.status).toBe(409);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CONFLICT");
      expect(body.error.message).toContain("Leave request is no longer pending");
    });
  });

  describe("LOGGING: Raw Token Privacy Guarantee", () => {
    it("never logs raw parent approval token strings in logger calls", async () => {
      // Execute a variety of view and decision calls with known raw tokens
      await ParentApprovePage({ params: Promise.resolve({ token: RAW_VALID_TOKEN }) });
      await ParentApprovePage({ params: Promise.resolve({ token: RAW_UNKNOWN_TOKEN }) });
      await ParentApprovePage({ params: Promise.resolve({ token: RAW_EXPIRED_TOKEN }) });

      const req1 = new Request(`http://localhost/api/parent-approve/${RAW_UNKNOWN_TOKEN}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVED" }),
      });
      await handleDecisionPost(req1, { params: Promise.resolve({ token: RAW_UNKNOWN_TOKEN }) });

      const req2 = new Request(`http://localhost/api/parent-approve/${RAW_EXPIRED_TOKEN}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVED" }),
      });
      await handleDecisionPost(req2, { params: Promise.resolve({ token: RAW_EXPIRED_TOKEN }) });

      // Inspect all logger calls
      const allCalls = [
        ...mockLoggerWarn.mock.calls,
        ...mockLoggerError.mock.calls,
        ...mockLoggerInfo.mock.calls,
      ];

      expect(allCalls.length).toBeGreaterThan(0);

      for (const call of allCalls) {
        const serialized = JSON.stringify(call);
        expect(serialized).not.toContain(RAW_VALID_TOKEN);
        expect(serialized).not.toContain(RAW_UNKNOWN_TOKEN);
        expect(serialized).not.toContain(RAW_EXPIRED_TOKEN);
        expect(serialized).not.toContain(RAW_USED_TOKEN);
      }
    });
  });
});
