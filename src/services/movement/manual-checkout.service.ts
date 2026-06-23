import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";

import { recordMovement } from "./record-movement.service";

export type ManualCheckoutInput = {
  studentId: string;
  leaveRequestId?: string;
  recordedBy: string;
  reason?: string;
};

export type ManualCheckoutResult = {
  movementEventId: string;
  studentId: string;
  newState: string;
};

export async function manualCheckout(
  input: ManualCheckoutInput
): Promise<ManualCheckoutResult> {
  const student = await studentRepository.findById(input.studentId);

  if (!student) {
    throw new NotFoundError("Student");
  }

  const currentState = student.currentLocationState;

  if (
    currentState !== MOVEMENT_STATE.IN_HOSTEL &&
    currentState !== MOVEMENT_STATE.APPROVED_LEAVE
  ) {
    throw new ConflictError(
      `Cannot perform manual checkout from state: ${currentState}`
    );
  }

  return await transaction(async (tx) => {
    const movementEvent = await recordMovement({
      studentId: input.studentId,
      leaveRequestId: input.leaveRequestId,
      fromState: currentState,
      toState: MOVEMENT_STATE.CHECKED_OUT,
      eventType: MOVEMENT_EVENT.MANUAL_CHECKOUT,
      movementMethod: MOVEMENT_METHOD.MANUAL,
      recordedBy: input.recordedBy,
      isManualOverride: true,
      overrideReason: input.reason,
      dbClient: tx,
    });

    return {
      movementEventId: movementEvent.id,
      studentId: input.studentId,
      newState: MOVEMENT_STATE.CHECKED_OUT,
    };
  });
}
