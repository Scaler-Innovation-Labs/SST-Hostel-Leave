// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGenerateQr = vi.fn();
const mockInvalidateQr = vi.fn();
const mockManualReturn = vi.fn();
const mockMarkOverdue = vi.fn();
const mockRecordMovement = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] });
const mockRequireRole = vi.fn().mockReturnValue({ id: "U1", roles: ["STUDENT"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
  requireRole: (...args: any[]) => mockRequireRole(...args),
}));

vi.mock("@/services/movement/generate-qr.service", () => ({
  generateQrPass: (...args: any[]) => mockGenerateQr(...args),
}));

vi.mock("@/services/movement/invalidate-qr.service", () => ({
  invalidateQrPass: (...args: any[]) => mockInvalidateQr(...args),
}));

vi.mock("@/services/movement/manual-return.service", () => ({
  manualReturn: (...args: any[]) => mockManualReturn(...args),
}));

vi.mock("@/services/movement/mark-overdue.service", () => ({
  markOverdue: (...args: any[]) => mockMarkOverdue(...args),
}));

vi.mock("@/services/movement/record-movement.service", () => ({
  recordMovement: (...args: any[]) => mockRecordMovement(...args),
}));

import { POST as GENERATE_QR } from "@/app/api/v1/movements/generate-qr/route";
import { POST as INVALIDATE } from "@/app/api/v1/movements/qr-passes/invalidate/route";
import { POST as MANUAL_RETURN } from "@/app/api/v1/movements/manual-return/route";
import { POST as MARK_OVERDUE } from "@/app/api/v1/movements/mark-overdue/route";
import { POST as RECORD } from "@/app/api/v1/movements/record/route";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["ADMIN"] });
  mockRequireRole.mockReturnValue({ id: "U1", roles: ["STUDENT"] });
  mockGenerateQr.mockResolvedValue({ id: "QP1", token: "t" });
  mockInvalidateQr.mockResolvedValue({ id: "QP1", status: "INVALIDATED" });
  mockManualReturn.mockResolvedValue({ success: true });
  mockMarkOverdue.mockResolvedValue({ success: true });
  mockRecordMovement.mockResolvedValue({ id: "ME1" });
});

function jsonReq(body: unknown, url = "http://localhost:3000/api/v1/movements/generate-qr"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/movements/generate-qr", () => {
  it("generates a QR pass for the authenticated student", async () => {
    const res = await GENERATE_QR(jsonReq({ leaveRequestId: UUID, qrType: "LEAVE_EXIT" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockGenerateQr).toHaveBeenCalledWith({
      leaveRequestId: UUID,
      userId: "U1",
      qrType: "LEAVE_EXIT",
      expiresAt: undefined,
    });
  });

  it("rejects an invalid qrType", async () => {
    const res = await GENERATE_QR(jsonReq({ leaveRequestId: UUID, qrType: "NOPE" }));

    expect(res.status).toBe(400);
    expect(mockGenerateQr).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/movements/qr-passes/invalidate", () => {
  it("invalidates a QR pass", async () => {
    const res = await INVALIDATE(jsonReq({ qrPassId: UUID, reason: "Lost card" }, "http://localhost:3000/api/v1/movements/qr-passes/invalidate"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockInvalidateQr).toHaveBeenCalledWith({ qrPassId: UUID, recordedBy: "U1", reason: "Lost card" });
  });

  it("rejects a missing qrPassId", async () => {
    const res = await INVALIDATE(jsonReq({ reason: "x" }, "http://localhost:3000/api/v1/movements/qr-passes/invalidate"));

    expect(res.status).toBe(400);
    expect(mockInvalidateQr).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/movements/manual-return", () => {
  it("records a manual return", async () => {
    const res = await MANUAL_RETURN(jsonReq({ studentId: UUID }, "http://localhost:3000/api/v1/movements/manual-return"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockManualReturn).toHaveBeenCalledWith({ studentId: UUID, recordedBy: "U1", reason: undefined });
  });
});

describe("POST /api/v1/movements/mark-overdue", () => {
  it("marks a student overdue", async () => {
    const res = await MARK_OVERDUE(jsonReq({ studentId: UUID }, "http://localhost:3000/api/v1/movements/mark-overdue"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockMarkOverdue).toHaveBeenCalledWith({ studentId: UUID, recordedBy: "U1" });
  });

  it("rejects a missing studentId", async () => {
    const res = await MARK_OVERDUE(jsonReq({}, "http://localhost:3000/api/v1/movements/mark-overdue"));

    expect(res.status).toBe(400);
    expect(mockMarkOverdue).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/movements/record", () => {
  it("records a movement event", async () => {
    const body = { studentId: UUID, fromState: "IN_HOSTEL", toState: "CHECKED_OUT", eventType: "EXIT_HOSTEL", movementMethod: "QR_SCAN" };
    const res = await RECORD(jsonReq(body, "http://localhost:3000/api/v1/movements/record"));
    const parsed = await res.json();

    expect(res.status).toBe(200);
    expect(parsed.success).toBe(true);
    expect(mockRecordMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: UUID,
        fromState: "IN_HOSTEL",
        toState: "CHECKED_OUT",
        eventType: "EXIT_HOSTEL",
        movementMethod: "QR_SCAN",
        recordedBy: "U1",
      }),
    );
  });

  it("rejects a body missing eventType", async () => {
    const res = await RECORD(jsonReq({ studentId: UUID, fromState: "IN_HOSTEL", toState: "CHECKED_OUT" }, "http://localhost:3000/api/v1/movements/record"));

    expect(res.status).toBe(400);
    expect(mockRecordMovement).not.toHaveBeenCalled();
  });
});
