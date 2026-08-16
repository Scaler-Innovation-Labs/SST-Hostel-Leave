import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { assertCanAccessStudent } from "@/services/shared/authorization.service";

import { recordMovement } from "./record-movement.service";

export type ManualCheckoutInput = {
  studentId: string;
  leaveRequestId?: string;
  currentUser: CurrentUser;
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

  // Hostel-scope guard: a scoped ADMIN must only mutate students in their
  // own hostel; SUPER_ADMIN is unrestricted.
  await assertCanAccessStudent(input.currentUser, input.studentId);

  const currentState = student.currentLocationState;

  if (currentState !== MOVEMENT_STATE.IN_HOSTEL) {
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
      recordedBy: input.currentUser.id,
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
