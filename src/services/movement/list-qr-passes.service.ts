import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";

export async function listQrPasses(leaveRequestId: string) {
  const qrPass = await qrPassRepository.findByLeaveRequestId(leaveRequestId);
  return qrPass ? [qrPass] : [];
}
