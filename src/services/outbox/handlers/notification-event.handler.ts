import type {
  NotificationEvent,
} from "@/constants/notification/notification-event";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { logger } from "@/lib/logger";
import {
  notificationService,
} from "@/services/notification/notification.service";
import type {
  OutboxEventRow,
} from "@/types/outbox/outbox-event";

/**
 * Rule lookup in the notification service filters by the leave type (and
 * routes Slack by hostel), so notifications that arrive via
 * NOTIFICATION_REQUESTED need those resolved from the leave before dispatch.
 */
async function resolveLeaveRouting(
  leaveRequestId?: string
): Promise<{ leaveTypeId?: string; hostelId?: string }> {
  if (!leaveRequestId) return {};

  const leave = await leaveRepository.findById(leaveRequestId);
  if (!leave) return {};

  let hostelId: string | undefined;
  const student = await studentRepository.findById(leave.studentId);
  if (student) {
    const user = await userRepository.findById(student.userId);
    hostelId = user?.hostelId ?? undefined;
  }

  return { leaveTypeId: leave.leaveTypeId, hostelId };
}

export async function handleNotificationEvent(
  event: OutboxEventRow
): Promise<void> {
  const { payload } = event;

  const notificationType = payload
    .notificationType as NotificationEvent;
  const variables = (payload.variables ?? {}) as Record<
    string,
    string
  >;

  if (!notificationType) {
    logger.warn("No notificationType in payload", { eventId: event.id });
    return;
  }

  const { leaveTypeId, hostelId } = await resolveLeaveRouting(
    payload.leaveRequestId as string | undefined
  );

  const result = await notificationService.notify(notificationType, {
    leaveRequestId: payload.leaveRequestId as
      | string
      | undefined,
    leaveExtensionId: payload.leaveExtensionId as
      | string
      | undefined,
    leaveTypeId,
    hostelId,
    userId: payload.userId as string | undefined,
    parentId: payload.parentId as string | undefined,
    recipientEmail: payload.recipientEmail as
      | string
      | undefined,
    recipientPhone: payload.recipientPhone as
      | string
      | undefined,
    variables,
  });

  // A notification that never delivered must not be marked PROCESSED —
  // rethrow so the outbox worker requeues/retries the event.
  if (!result.success) {
    throw new Error(
      `Notification delivery failed for ${notificationType}: ${result.failures.join("; ")}`
    );
  }

  logger.info("Notification dispatched", { notificationType });
}

