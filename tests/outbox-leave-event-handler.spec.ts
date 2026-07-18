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

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/db/repositories/parent/parent.repository", () => ({
  parentRepository: {
    findById: vi.fn(),
    findPrimaryByStudentId: vi.fn(),
  },
}));

import { handleLeaveEvent } from "@/services/outbox/handlers/leave-event.handler";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";

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
    aggregateType: "LEAVE_REQUEST",
    aggregateId: "L1",
    payload: {
      leaveRequestId: "L1",
      userId: "U1",
      recipientEmail: "student@test.com",
      recipientPhone: "+1234567890",
      variables: { leaveId: "L1" },
      ...overrides,
    },
    status: "PENDING",
    attemptCount: 0,
    lastError: null,
    createdAt: new Date(),
    processedAt: null,
  };
}

describe("handleLeaveEvent", () => {
  it("maps LEAVE_CREATED to LEAVE_SUBMITTED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_CREATED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_SUBMITTED", expect.any(Object));
  });

  it("maps LEAVE_APPROVED to LEAVE_APPROVED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_APPROVED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_APPROVED", expect.any(Object));
  });

  it("maps LEAVE_REJECTED to LEAVE_REJECTED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_REJECTED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_REJECTED", expect.any(Object));
  });

  it("maps LEAVE_CANCELLED to LEAVE_CANCELLED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_CANCELLED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_CANCELLED", expect.any(Object));
  });

  it("maps LEAVE_COMPLETED to LEAVE_COMPLETED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_COMPLETED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_COMPLETED", expect.any(Object));
  });

  it("maps LEAVE_EXPIRED to LEAVE_EXPIRED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_EXPIRED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_EXPIRED", expect.any(Object));
  });

  it("maps LEAVE_EXTENDED to LEAVE_EXTENSION_REQUESTED notification", async () => {
    await handleLeaveEvent(makeEvent("LEAVE_EXTENDED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_EXTENSION_REQUESTED", expect.any(Object));
  });

  it("handles PARENT_APPROVAL_REQUIRED without dispatching notification directly (uses outbox instead)", async () => {
    await handleLeaveEvent(makeEvent("PARENT_APPROVAL_REQUIRED"));

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("passes payload fields to notification context", async () => {
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

    await handleLeaveEvent(makeEvent("LEAVE_CREATED"));

    expect(mockNotify).toHaveBeenCalledWith("LEAVE_SUBMITTED", expect.objectContaining({
      leaveRequestId: "L1",
      userId: "U1",
      recipientEmail: "student@test.com",
      recipientPhone: "+1234567890",
      variables: expect.objectContaining({ leaveId: "L1" }),
    }));
  });

  it("does not throw for unmapped event types", async () => {
    const event = makeEvent("UNMAPPED_EVENT");

    await expect(handleLeaveEvent(event)).resolves.toBeUndefined();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
