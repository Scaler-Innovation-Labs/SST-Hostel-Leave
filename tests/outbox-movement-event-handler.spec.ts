// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockNotify = vi.fn().mockResolvedValue(undefined);

vi.mock("@/services/notification/notification.service", () => ({
  notificationService: {
    notify: (...args: any[]) => mockNotify(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/db/repositories/auth/user.repository", () => ({
  userRepository: {
    findById: vi.fn(),
  },
}));

import { handleMovementEvent } from "@/services/outbox/handlers/movement-event.handler";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/auth/user.repository";

beforeEach(() => {
  vi.resetAllMocks();
  // Default: all repositories return null (no data resolved)
  (leaveRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (studentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
});

function makeEvent(eventType: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "OE1",
    eventType,
    aggregateType: "QR_PASS",
    aggregateId: "QP1",
    payload: {
      qrPassId: "QP1",
      leaveRequestId: "L1",
      studentId: "S1",
      ...overrides,
    },
    status: "PENDING",
    attemptCount: 0,
    lastError: null,
    createdAt: new Date(),
    processedAt: null,
  };
}

describe("handleMovementEvent", () => {
  it("maps QR_GENERATED to QR_GENERATED notification", async () => {
    await handleMovementEvent(makeEvent("QR_GENERATED"));

    expect(mockNotify).toHaveBeenCalledWith("QR_GENERATED", expect.any(Object));
  });

  it("does not send notification for unmapped movement events", async () => {
    await handleMovementEvent(makeEvent("MOVEMENT_RECORDED"));

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("passes payload fields for QR_GENERATED", async () => {
    (leaveRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      studentId: "S1",
      startAt: new Date("2025-06-01"),
      endAt: new Date("2025-06-05"),
    });
    (studentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "U1",
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      fullName: "Test Student",
      email: "student@test.com",
      phone: "+1234567890",
    });

    await handleMovementEvent(makeEvent("QR_GENERATED", {
      userId: "U1",
      recipientEmail: "student@test.com",
      variables: { qrPassId: "QP1" },
    }));

    expect(mockNotify).toHaveBeenCalledWith("QR_GENERATED", expect.objectContaining({
      leaveRequestId: "L1",
      recipientEmail: "student@test.com",
      recipientPhone: "+1234567890",
      variables: expect.objectContaining({ qrPassId: "QP1" }),
    }));
  });
});
