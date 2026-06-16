import type { CurrentUser } from "@/lib/auth/types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { NotFoundError } from "@/lib/errors";
import { verifyStudentOwnership } from "@/services/shared/authorization.service";

export async function listQrPasses(leaveRequestId: string, currentUser?: CurrentUser) {
  if (currentUser) {
    const leave = await leaveRepository.findById(leaveRequestId);
    if (!leave) {
      throw new NotFoundError("LeaveRequest");
    }
    await verifyStudentOwnership(currentUser, leave.studentId);
  }

  const qrPass = await qrPassRepository.findByLeaveRequestId(leaveRequestId);
  return qrPass ? [qrPass] : [];
}
