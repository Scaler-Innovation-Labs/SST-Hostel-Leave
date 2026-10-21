// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLeaveTypeFindById = vi.fn();
const mockQrFindByLeaveRequestId = vi.fn();
const mockQrCreate = vi.fn();
const mockQrUpdateExpiresAt = vi.fn();
const mockQrMarkAsClosed = vi.fn();
const mockQrInvalidate = vi.fn();
const mockPublish = vi.fn();
const mockSha256 = vi.fn();
const mockToHex = vi.fn();
const mockEncrypt = vi.fn();

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: any[]) => mockLeaveTypeFindById(...args),
  },
}));

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findByLeaveRequestId: (...args: any[]) => mockQrFindByLeaveRequestId(...args),
    create: (...args: any[]) => mockQrCreate(...args),
    updateExpiresAt: (...args: any[]) => mockQrUpdateExpiresAt(...args),
    markAsClosed: (...args: any[]) => mockQrMarkAsClosed(...args),
    invalidate: (...args: any[]) => mockQrInvalidate(...args),
  },
}));

vi.mock("@/services/outbox/outbox.service", () => ({
  outboxService: {
    publish: (...args: any[]) => mockPublish(...args),
  },
}));

vi.mock("@/lib/crypto", () => ({
  sha256: (...args: any[]) => mockSha256(...args),
  toHex: (...args: any[]) => mockToHex(...args),
}));

vi.mock("@/lib/qr-token-crypto", () => ({
  encryptQrToken: (...args: any[]) => mockEncrypt(...args),
}));

import {
  extendQrPassWindow,
  issueQrPassForApprovedLeave,
  retireQrPassOnLeaveCompletion,
} from "@/services/leave/qr-pass-lifecycle.service";

const TX = { marker: "tx" };

const LEAVE = {
  id: "LR1",
  studentId: "S1",
  leaveTypeId: "LT1",
  startAt: new Date("2026-06-10T00:00:00.000Z"),
  endAt: new Date("2026-06-15T00:00:00.000Z"),
};

const PASS = {
  id: "QP1",
  leaveRequestId: "LR1",
  studentId: "S1",
  status: "ACTIVE",
  firstScanAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLeaveTypeFindById.mockResolvedValue({ id: "LT1", qrMode: "EXIT_ONLY" });
  mockQrFindByLeaveRequestId.mockResolvedValue(null);
  mockQrCreate.mockImplementation((input: any) => ({
    ...input,
    id: "QP1",
  }));
  mockQrUpdateExpiresAt.mockResolvedValue(PASS);
  mockQrMarkAsClosed.mockResolvedValue({ ...PASS, status: "USED" });
  mockQrInvalidate.mockResolvedValue({ ...PASS, status: "INVALIDATED" });
  mockSha256.mockResolvedValue("token-hash");
  mockToHex.mockReturnValue("raw-token");
  mockEncrypt.mockResolvedValue("token-envelope");
});

describe("issueQrPassForApprovedLeave", () => {
  it("skips leave types that do not use QR", async () => {
    mockLeaveTypeFindById.mockResolvedValue({ id: "LT1", qrMode: "NONE" });

    await issueQrPassForApprovedLeave(LEAVE, TX);

    expect(mockQrCreate).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("is idempotent when a pass already exists", async () => {
    mockQrFindByLeaveRequestId.mockResolvedValue(PASS);

    await issueQrPassForApprovedLeave(LEAVE, TX);

    expect(mockQrCreate).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("creates an exit pass and publishes QR_GENERATED", async () => {
    await issueQrPassForApprovedLeave(LEAVE, TX);

    expect(mockQrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        leaveRequestId: "LR1",
        studentId: "S1",
        qrType: "LEAVE_EXIT",
        tokenHash: "token-hash",
        tokenEnc: "token-envelope",
        status: "ACTIVE",
        validFrom: LEAVE.startAt,
        expiresAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
      TX
    );
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "QR_GENERATED",
        aggregateId: "QP1",
        payload: expect.objectContaining({
          qrPassId: "QP1",
          leaveRequestId: "LR1",
          studentId: "S1",
          qrType: "LEAVE_EXIT",
        }),
      }),
      TX
    );
  });

  it("creates a return pass for RETURN_ONLY leave types", async () => {
    mockLeaveTypeFindById.mockResolvedValue({ id: "LT1", qrMode: "RETURN_ONLY" });

    await issueQrPassForApprovedLeave(LEAVE, TX);

    expect(mockQrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ qrType: "LEAVE_RETURN" }),
      TX
    );
  });
});

describe("extendQrPassWindow", () => {
  it("extends an active pass by the return grace", async () => {
    mockQrFindByLeaveRequestId.mockResolvedValue(PASS);

    await extendQrPassWindow("LR1", new Date("2026-06-20T00:00:00.000Z"), TX);

    expect(mockQrUpdateExpiresAt).toHaveBeenCalledWith(
      "QP1",
      new Date("2026-06-21T00:00:00.000Z"),
      TX
    );
  });

  it("leaves a non-active pass untouched", async () => {
    mockQrFindByLeaveRequestId.mockResolvedValue({ ...PASS, status: "USED" });

    await extendQrPassWindow("LR1", new Date("2026-06-20T00:00:00.000Z"), TX);

    expect(mockQrUpdateExpiresAt).not.toHaveBeenCalled();
  });
});

describe("retireQrPassOnLeaveCompletion", () => {
  it("invalidates an unused pass", async () => {
    mockQrFindByLeaveRequestId.mockResolvedValue(PASS);

    const status = await retireQrPassOnLeaveCompletion("LR1", TX);

    expect(mockQrInvalidate).toHaveBeenCalledWith("QP1", TX);
    expect(mockQrMarkAsClosed).not.toHaveBeenCalled();
    expect(status).toBe("INVALIDATED");
  });

  it("closes a pass with an open movement session", async () => {
    mockQrFindByLeaveRequestId.mockResolvedValue({
      ...PASS,
      firstScanAt: new Date("2026-06-12T10:00:00.000Z"),
    });

    const status = await retireQrPassOnLeaveCompletion("LR1", TX);

    expect(mockQrMarkAsClosed).toHaveBeenCalledWith("QP1", TX);
    expect(mockQrInvalidate).not.toHaveBeenCalled();
    expect(status).toBe("USED");
  });

  it("returns the existing status when no ACTIVE pass exists", async () => {
    mockQrFindByLeaveRequestId.mockResolvedValue({ ...PASS, status: "USED" });

    const status = await retireQrPassOnLeaveCompletion("LR1", TX);

    expect(mockQrMarkAsClosed).not.toHaveBeenCalled();
    expect(mockQrInvalidate).not.toHaveBeenCalled();
    expect(status).toBe("USED");
  });
});
