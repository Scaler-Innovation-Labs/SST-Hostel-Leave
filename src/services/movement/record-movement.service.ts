import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import type { MovementState } from "@/constants/movement";
import type { MovementEvent } from "@/constants/movement/movement-event";
import type { MovementMethod } from "@/constants/movement/movement-method";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import type { MovementEventRow } from "@/db/repositories/movement/movement-event.repository";
import { movementEventRepository } from "@/db/repositories/movement/movement-event.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { type DbClient,transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import {
  canTransition,
  getNextState,
  type MovementAction,
} from "@/lib/workflows/movement-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type RecordMovementInput = {
  studentId: string;
  leaveRequestId?: string;
  qrPassId?: string;
  fromState: MovementState;
  toState: MovementState;
  eventType: MovementEvent;
  movementMethod: MovementMethod;
  isManualOverride?: boolean;
  overrideReason?: string;
  recordedBy?: string;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
  dbClient?: DbClient;
};

const EVENT_TYPE_TO_ACTION: Record<string, MovementAction> = {
  LEAVE_APPROVED: "APPROVE_LEAVE",
  EXIT_HOSTEL: "EXIT_HOSTEL",
  ENTER_HOSTEL: "ENTER_HOSTEL",
  AUTO_OVERDUE: "MARK_OVERDUE",
  MANUAL_RETURN: "MANUAL_RETURN",
  QR_INVALIDATED: "INVALIDATE_QR",
};

export async function recordMovement(
  input: RecordMovementInput
): Promise<MovementEventRow> {
  const action = EVENT_TYPE_TO_ACTION[input.eventType];

  if (!action) {
    throw new ConflictError(
      `Unknown movement event type: ${input.eventType}`
    );
  }

  if (!canTransition(input.fromState, action)) {
    throw new ConflictError(
      `Invalid movement transition: Cannot perform ${input.eventType} from ${input.fromState}`
    );
  }

  const expectedToState = getNextState(input.fromState, action);

  if (input.toState !== expectedToState) {
    throw new ConflictError(
      `Invalid movement transition: ${input.fromState} + ${input.eventType} should transition to ${expectedToState}, not ${input.toState}`
    );
  }

  const exec = async (client: DbClient) => {
    const student = await studentRepository.findById(
      input.studentId,
      client
    );

    if (!student) {
      throw new NotFoundError("Student not found");
    }

    if (student.currentLocationState !== input.fromState) {
      throw new ConflictError(
        `Student state mismatch: expected ${input.fromState}, found ${student.currentLocationState}`
      );
    }

    const event = await movementEventRepository.create(
      {
        studentId: input.studentId,
        leaveRequestId: input.leaveRequestId ?? null,
        qrPassId: input.qrPassId ?? null,
        eventType: input.eventType,
        fromState: input.fromState,
        toState: input.toState,
        movementMethod: input.movementMethod,
        isManualOverride: input.isManualOverride ?? false,
        overrideReason: input.overrideReason ?? null,
        recordedBy: input.recordedBy ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        metadata: input.metadata ?? null,
      },
      client
    );

    await studentRepository.updateCurrentLocationState(
      input.studentId,
      input.toState,
      client
    );

    await auditService.record(
      AUDIT_ACTION.CREATE,
      AUDIT_ENTITY_TYPE.MOVEMENT_EVENT,
      event.id,
      input.recordedBy ?? null,
      {
        eventType: input.eventType,
        fromState: input.fromState,
        toState: input.toState,
        movementMethod: input.movementMethod,
        leaveRequestId: input.leaveRequestId,
        qrPassId: input.qrPassId,
      },
      client
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.MOVEMENT_RECORDED,
      aggregateType: AGGREGATE_TYPE.MOVEMENT_EVENT,
      aggregateId: event.id,
      payload: {
        movementEventId: event.id,
        studentId: input.studentId,
        eventType: input.eventType,
        fromState: input.fromState,
        toState: input.toState,
      },
    }, client);

    return event;
  };

  if (input.dbClient) {
    return exec(input.dbClient);
  }

  return transaction(async (tx) => exec(tx));
}
