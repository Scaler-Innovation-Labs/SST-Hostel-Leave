import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import {
  NOTIFICATION_EVENT,
  type NotificationEvent,
} from "@/constants/notification/notification-event";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { recordMovement } from "@/services/movement/record-movement.service";
import {
  notificationService,
} from "@/services/notification/notification.service";
import { generateParentApproval } from "@/services/parent/generate-parent-approval.service";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { parentRepository } from "@/db/repositories/hostel/parent.repository";
import type { OutboxEventRow } from "@/types/outbox/outbox-event";

const LEAVE_EVENT_TO_NOTIFICATION: Record<string, NotificationEvent> = {
  LEAVE_CREATED: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
  LEAVE_APPROVED: NOTIFICATION_EVENT.LEAVE_APPROVED,
  LEAVE_REJECTED: NOTIFICATION_EVENT.LEAVE_REJECTED,
  LEAVE_CANCELLED: NOTIFICATION_EVENT.LEAVE_CANCELLED,
  LEAVE_COMPLETED: NOTIFICATION_EVENT.LEAVE_COMPLETED,
  LEAVE_EXPIRED: NOTIFICATION_EVENT.LEAVE_EXPIRED,
  LEAVE_EXTENDED: NOTIFICATION_EVENT.LEAVE_EXTENSION_REQUESTED,
  LEAVE_EXTENSION_APPROVED: NOTIFICATION_EVENT.LEAVE_EXTENSION_APPROVED,
  LEAVE_EXTENSION_REJECTED: NOTIFICATION_EVENT.LEAVE_EXTENSION_REJECTED,
  PARENT_APPROVAL_REQUIRED: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
};

type ResolvedContext = {
  email?: string;
  phone?: string;
  variables: Record<string, string>;
  studentId?: string;
  leaveTypeId?: string;
  hostelId?: string;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function resolveContext(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<ResolvedContext> {
  // For parent-approval events, load parent info
  if (eventType === OUTBOX_EVENT_TYPE.PARENT_APPROVAL_REQUIRED) {
    const parentId = payload.parentId as string | undefined;
    if (parentId) {
      const parent = await parentRepository.findById(parentId);
      if (parent) {
        return {
          email: parent.email ?? undefined,
          phone: parent.phone ?? undefined,
          variables: (payload.variables ?? {}) as Record<string, string>,
        };
      }
    }
    return { variables: {} };
  }

  // For regular leave events, resolve through student → user
  const leaveId = (payload.leaveId ?? payload.leaveRequestId) as string | undefined;
  const studentId = payload.studentId as string | undefined;

  // Try to load leave for dates and request number
  let leave = null;
  if (leaveId) {
    leave = await leaveRepository.findById(leaveId);
  }

  // Resolve student → user for name and contact
  const resolvedStudentId = studentId ?? leave?.studentId;
  let studentName = "";
  let email: string | undefined;
  let phone: string | undefined;
  let hostelId: string | undefined;

  if (resolvedStudentId) {
    const student = await studentRepository.findById(resolvedStudentId);
    if (student) {
      const user = await userRepository.findById(student.userId);
      if (user) {
        studentName = user.fullName;
        email = user.email ?? undefined;
        phone = user.phone ?? undefined;
        hostelId = user.hostelId ?? undefined;
      }
    }
  }

  // Build template variables
  const variables: Record<string, string> = {
    ...(payload.variables ?? {}) as Record<string, string>,
  };

  if (leaveId) variables.leaveId = leaveId;
  if (studentName) variables.studentName = studentName;
  if (payload.requestNumber) variables.requestNumber = String(payload.requestNumber);

  if (leave) {
    variables.dates = `${formatDate(leave.startAt)} – ${formatDate(leave.endAt)}`;
    if (leave.expectedReturnAt) {
      variables.expectedReturnDate = formatDate(leave.expectedReturnAt);
    }
  }

  if (payload.reason) variables.reason = String(payload.reason);
  if (payload.decision) variables.decision = String(payload.decision);

  return {
    email,
    phone,
    variables,
    studentId: resolvedStudentId,
    leaveTypeId: leave?.leaveTypeId ?? undefined,
    hostelId,
  };
}

export async function handleLeaveEvent(
  event: OutboxEventRow
): Promise<void> {
  const { eventType, payload } = event;

  const leaveId = (payload.leaveId ?? payload.leaveRequestId) as string | undefined;
  let studentId: string | undefined = payload.studentId as string | undefined;

  if (leaveId) {
    const leave = await leaveRepository.findById(leaveId);
    if (leave) {
      studentId ??= leave.studentId;
    }
  }

  const notificationType = LEAVE_EVENT_TO_NOTIFICATION[eventType];

  if (notificationType && eventType !== OUTBOX_EVENT_TYPE.PARENT_APPROVAL_REQUIRED) {
    const context = await resolveContext(eventType, payload);

    await notificationService.notify(notificationType, {
      leaveRequestId: leaveId,
      leaveExtensionId: payload.extensionId as string | undefined,
      leaveTypeId: context.leaveTypeId,
      studentId: context.studentId ?? studentId,
      hostelId: context.hostelId,
      userId: payload.userId as string | undefined,
      recipientEmail: context.email,
      recipientPhone: context.phone,
      variables: context.variables,
    });

    console.info(`[OUTBOX] Notification dispatched for ${eventType}: ${notificationType}`);
  } else {
    console.warn(`[OUTBOX] No notification mapping for leave event: ${eventType}`);
  }

  if (eventType === OUTBOX_EVENT_TYPE.PARENT_APPROVAL_REQUIRED) {
    const leaveRequestId = payload.leaveRequestId as string;
    const studentId = payload.studentId as string;
    const studentName = payload.studentName as string;
    const leaveDates = payload.leaveDates as string;
    const leaveReason = payload.leaveReason as string;
    const baseUrl = payload.baseUrl as string;
    const approvalStepId = payload.approvalStepId as string;
    const approvalStepKey = payload.approvalStepKey as string;

    if (leaveRequestId && studentId && approvalStepId) {
      try {
        await generateParentApproval(
          { leaveRequestId, studentId, studentName, leaveDates, leaveReason, baseUrl },
          { id: approvalStepId, stepKey: approvalStepKey },
        );
        console.info(`[OUTBOX] Parent approval generated for leave: ${leaveRequestId}`);
      } catch (error) {
        console.error(`[OUTBOX] Failed to generate parent approval for leave ${leaveRequestId}:`, error);
      }
    }
    return;
  }

  if (leaveId && studentId) {
    const student = await studentRepository.findById(studentId);
    const currentState = student?.currentLocationState;

    if (eventType === OUTBOX_EVENT_TYPE.LEAVE_APPROVED) {
      try {
        await recordMovement({
          studentId,
          leaveRequestId: leaveId,
          fromState: MOVEMENT_STATE.IN_HOSTEL,
          toState: MOVEMENT_STATE.APPROVED_LEAVE,
          eventType: MOVEMENT_EVENT.LEAVE_APPROVED,
          movementMethod: MOVEMENT_METHOD.SYSTEM,
        });
        console.info(`[OUTBOX] Movement recorded for leave approval: ${leaveId}`);
      } catch (error) {
        console.error(`[OUTBOX] Failed to record movement for leave ${leaveId}:`, error);
      }
    }

    if (eventType === OUTBOX_EVENT_TYPE.LEAVE_CANCELLED && currentState === MOVEMENT_STATE.APPROVED_LEAVE) {
      try {
        await recordMovement({
          studentId,
          leaveRequestId: leaveId,
          fromState: MOVEMENT_STATE.APPROVED_LEAVE,
          toState: MOVEMENT_STATE.IN_HOSTEL,
          eventType: MOVEMENT_EVENT.QR_INVALIDATED,
          movementMethod: MOVEMENT_METHOD.SYSTEM,
        });
        console.info(`[OUTBOX] Movement recorded for leave cancellation: ${leaveId}`);
      } catch (error) {
        console.error(`[OUTBOX] Failed to record movement for leave cancellation ${leaveId}:`, error);
      }
    }

    if (
      eventType === OUTBOX_EVENT_TYPE.LEAVE_EXPIRED &&
      (currentState === MOVEMENT_STATE.APPROVED_LEAVE ||
        currentState === MOVEMENT_STATE.CHECKED_OUT ||
        currentState === MOVEMENT_STATE.OUTSIDE_HOSTEL)
    ) {
      try {
        await recordMovement({
          studentId,
          leaveRequestId: leaveId,
          fromState: currentState,
          toState: MOVEMENT_STATE.OVERDUE,
          eventType: MOVEMENT_EVENT.AUTO_OVERDUE,
          movementMethod: MOVEMENT_METHOD.SYSTEM,
        });
        console.info(`[OUTBOX] Movement recorded for leave expiry: ${leaveId}`);
      } catch (error) {
        console.error(`[OUTBOX] Failed to record movement for leave expiry ${leaveId}:`, error);
      }
    }
  }
}

