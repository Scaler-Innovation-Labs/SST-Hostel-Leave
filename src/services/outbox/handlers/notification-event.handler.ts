import type {
  NotificationEvent,
} from "@/constants/notification/notification-event";
import { logger } from "@/lib/logger";
import {
  notificationService,
} from "@/services/notification/notification.service";
import type {
  OutboxEventRow,
} from "@/types/outbox/outbox-event";

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

  await notificationService.notify(notificationType, {
    leaveRequestId: payload.leaveRequestId as
      | string
      | undefined,
    leaveExtensionId: payload.leaveExtensionId as
      | string
      | undefined,
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

  logger.info("Notification dispatched", { notificationType });
}

