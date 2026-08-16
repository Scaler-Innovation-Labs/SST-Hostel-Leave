import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { assertCanAccessStudent } from "@/services/shared/authorization.service";

import { recordMovement } from "./record-movement.service";

export type MarkOverdueInput = {
  studentId: string;
  currentUser: CurrentUser;
};

export type MarkOverdueResult = {
  movementEventId: string;
  studentId: string;
  newState: string;
};

export async function markOverdue(
  input: MarkOverdueInput
): Promise<MarkOverdueResult> {
  const student = await studentRepository.findById(input.studentId);

  if (!student) {
    throw new NotFoundError("Student");
  }

  // Hostel-scope guard: a scoped ADMIN must only mutate students in their
  // own hostel; SUPER_ADMIN is unrestricted.
  await assertCanAccessStudent(input.currentUser, input.studentId);

  const currentState = student.currentLocationState;

  if (
    currentState !== MOVEMENT_STATE.CHECKED_OUT &&
    currentState !== MOVEMENT_STATE.OUTSIDE_HOSTEL
  ) {
    throw new ConflictError(
      `Cannot mark overdue from state: ${currentState}`
    );
  }

  return await transaction(async (tx) => {
    const movementEvent = await recordMovement({
      studentId: input.studentId,
      fromState: currentState,
      toState: MOVEMENT_STATE.OVERDUE,
      eventType: MOVEMENT_EVENT.AUTO_OVERDUE,
      movementMethod: MOVEMENT_METHOD.SYSTEM,
      recordedBy: input.currentUser.id,
      isManualOverride: true,
      dbClient: tx,
    });

    return {
      movementEventId: movementEvent.id,
      studentId: input.studentId,
      newState: MOVEMENT_STATE.OVERDUE,
    };
  });
}
