import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { logger } from "@/lib/logger";
import { markOverdue } from "@/services/movement/mark-overdue.service";

const SYSTEM_USER = { id: "SYSTEM" };

export async function runMarkOverdueJob(): Promise<{ job: string; total: number; marked: number; skipped: number; errors: string[] }> {
  const eligibleStates = [
    MOVEMENT_STATE.CHECKED_OUT,
    MOVEMENT_STATE.OUTSIDE_HOSTEL,
    MOVEMENT_STATE.APPROVED_LEAVE,
  ];

  let total = 0;
  let marked = 0;
  const errors: string[] = [];

  for (const state of eligibleStates) {
    const students = await studentRepository.findByLocationState(state);
    total += students.length;

    for (const student of students) {
      try {
        await markOverdue({
          studentId: student.id,
          recordedBy: SYSTEM_USER.id,
        });
        marked++;
      } catch (error) {
        errors.push(
          `Failed to mark overdue for ${student.id}: ${error instanceof Error ? error.message : "Unknown"}`
        );
        logger.error("Mark overdue job failed for student", {
          studentId: student.id,
          error,
        });
      }
    }
  }

  return {
    job: "mark-overdue",
    total,
    marked,
    skipped: total - marked - errors.length,
    errors,
  };
}
