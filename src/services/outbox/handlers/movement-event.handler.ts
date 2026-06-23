import {
  NOTIFICATION_EVENT,
  type NotificationEvent,
} from "@/constants/notification/notification-event";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import {
  notificationService,
} from "@/services/notification/notification.service";
import type { OutboxEventRow } from "@/types/outbox/outbox-event";

const MOVEMENT_EVENT_TO_NOTIFICATION: Record<string, NotificationEvent> = {
  QR_GENERATED: NOTIFICATION_EVENT.QR_GENERATED,
};

type ResolvedContext = {
  email?: string;
  phone?: string;
  variables: Record<string, string>;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function resolveContext(
  payload: Record<string, unknown>,
): Promise<ResolvedContext> {
  const studentId = payload.studentId as string | undefined;
  const leaveRequestId = payload.leaveRequestId as string | undefined;

  const variables: Record<string, string> = {
    ...(payload.variables ?? {}) as Record<string, string>,
  };

  if (leaveRequestId) variables.leaveId = leaveRequestId;

  // 1. Resolve student → user for name and contact
  const resolvedStudentId = studentId ?? null;
  let studentName = "";
  let email: string | undefined;
  let phone: string | undefined;

  if (resolvedStudentId) {
    const student = await studentRepository.findById(resolvedStudentId);
    if (student) {
      const user = await userRepository.findById(student.userId);
      if (user) {
        studentName = user.fullName;
        email = user.email ?? undefined;
        phone = user.phone ?? undefined;
      }
    }
  }

  // 2. Always load leave data for dates when leaveRequestId is available
  //    (handles events like QR_GENERATED that have both studentId and leaveRequestId)
  if (leaveRequestId) {
    const leave = await leaveRepository.findById(leaveRequestId);
    if (leave) {
      variables.dates = `${formatDate(leave.startAt)} – ${formatDate(leave.endAt)}`;

      // If we couldn't resolve from studentId, fall back to leave → student → user
      if (!resolvedStudentId) {
        const student = await studentRepository.findById(leave.studentId);
        if (student) {
          const user = await userRepository.findById(student.userId);
          if (user) {
            studentName = user.fullName;
            email = user.email ?? undefined;
            phone = user.phone ?? undefined;
          }
        }
      }
    }
  }

  if (studentName) variables.studentName = studentName;

  return { email, phone, variables };
}

export async function handleMovementEvent(
  event: OutboxEventRow
): Promise<void> {
  const { eventType, payload } = event;

  const notificationType = MOVEMENT_EVENT_TO_NOTIFICATION[eventType];

  if (notificationType) {
    const context = await resolveContext(payload);

    const leaveRequestId = payload.leaveRequestId as string | undefined;
    let leaveTypeId: string | undefined;
    let hostelId: string | undefined;
    const studentId = payload.studentId as string | undefined;

    if (leaveRequestId) {
      const leave = await leaveRepository.findById(leaveRequestId);
      if (leave) {
        leaveTypeId = leave.leaveTypeId ?? undefined;
      }
    }

    if (studentId) {
      const student = await studentRepository.findById(studentId);
      if (student) {
        const user = await userRepository.findById(student.userId);
        if (user?.hostelId) {
          hostelId = user.hostelId;
        }
      }
    }

    await notificationService.notify(notificationType, {
      leaveRequestId,
      leaveTypeId,
      studentId,
      hostelId,
      userId: payload.studentId as string | undefined,
      recipientEmail: context.email,
      recipientPhone: context.phone,
      variables: context.variables,
    });

    console.info(`[OUTBOX] Notification dispatched for ${eventType}: ${notificationType}`);
  } else {
    console.info(`[OUTBOX] Movement event processed (no notification): ${eventType}`);
  }
}

