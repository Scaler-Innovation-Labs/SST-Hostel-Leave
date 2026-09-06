import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { type QrPass,qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

/** A QR pass safe to send to the frontend: bearer credentials stripped. */
export type PublicQrPass = Omit<QrPass, "tokenEnc">;

export async function listQrPasses(
  leaveRequestId: string,
  currentUser: CurrentUser
): Promise<PublicQrPass[]> {
  const leave = await leaveRepository.findById(leaveRequestId);
  if (!leave) {
    throw new NotFoundError("LeaveRequest");
  }
  // Scope-aware: students see only their own leaves; hostel-scoped
  // ADMIN/POC see only leaves in their hostels. Never verifyStudentOwnership
  // here — its staff pass-through would skip the hostel scope.
  await assertCanAccessLeave(currentUser, leave);

  const qrPass = await qrPassRepository.findByLeaveRequestId(leaveRequestId);
  if (!qrPass) return [];

  // The encrypted envelope must never leave the server: the frontend
  // renders the QR via /api/v1/qr/{passId}/image.
  const { tokenEnc: _tokenEnc, ...publicPass } = qrPass;
  return [publicPass];
}
