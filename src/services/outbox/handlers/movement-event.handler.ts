import {
  NOTIFICATION_EVENT,
  type NotificationEvent,
} from "@/constants/notification/notification-event";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { formatShortDate } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import {
  notificationService,
} from "@/services/notification/notification.service";
import type { OutboxEventRow } from "@/types/outbox/outbox-event";

const MOVEMENT_EVENT_TO_NOTIFICATION: Record<string, NotificationEvent> = {
  QR_GENERATED: NOTIFICATION_EVENT.QR_GENERATED,
  QR_SCANNED: NOTIFICATION_EVENT.QR_SCANNED,
  QR_INVALIDATED: NOTIFICATION_EVENT.QR_INVALIDATED,
};

type ResolvedContext = {
  email?: string;
  phone?: string;
  /** The user account backing the student — the correct value for the
   *  notification_logs.userId column (which references users.id, NOT
   *  students.id). */
  userId?: string;
  variables: Record<string, string>;
};

async function resolveContext(
  payload: Record<string, unknown>,
): Promise<ResolvedContext> {
  const studentId = payload.studentId as string | undefined;
  const leaveRequestId = payload.leaveRequestId as string | undefined;

  const variables: Record<string, string> = {
    ...(payload.variables ?? {}) as Record<string, string>,
  };

  if (leaveRequestId) variables.leaveId = leaveRequestId;

  // 1. Resolve student → user for name, contact, and the user id
  const resolvedStudentId = studentId ?? null;
  let studentName = "";
  let email: string | undefined;
  let phone: string | undefined;
  let userId: string | undefined;

  if (resolvedStudentId) {
    const student = await studentRepository.findById(resolvedStudentId);
    if (student) {
      userId = student.userId;
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
      variables.dates = `${formatShortDate(leave.startAt)} – ${formatShortDate(leave.endAt)}`;

      // If we couldn't resolve from studentId, fall back to leave → student → user
      if (!resolvedStudentId) {
        const student = await studentRepository.findById(leave.studentId);
        if (student) {
          userId = student.userId;
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

  // 3. Set scan context for QR_SCANNED events
  const scanType = payload.scanType as string | undefined;
  if (scanType) {
    variables.scanType = scanType === "EXIT_SCAN" ? "exit" : "return";
    // Show the scan time in IST (the campus timezone) regardless of the
    // server's own timezone — on Vercel the runtime is UTC.
    variables.time = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());
  }

  return { email, phone, userId, variables };
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

    const result = await notificationService.notify(notificationType, {
      leaveRequestId,
      leaveTypeId,
      studentId,
      hostelId,
      // The resolved USER account (users.id), never the student id — the
      // column references users and the in-app provider routes by user.
      userId: context.userId,
      recipientEmail: context.email,
      recipientPhone: context.phone,
      variables: context.variables,
    });

    // A notification that never delivered must not be marked PROCESSED —
    // rethrow so the outbox worker requeues/retries the event.
    if (!result.success) {
      throw new Error(
        `Notification delivery failed for ${eventType} (${notificationType}): ${result.failures.join("; ")}`
      );
    }

    logger.info("Notification dispatched", { eventType, notificationType });
  } else {
    logger.info("Movement event processed (no notification)", { eventType });
  }
}

