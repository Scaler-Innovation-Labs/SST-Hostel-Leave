import { QR_STATUS } from "@/constants/movement/qr-status";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";

export async function runCleanupQrJob(): Promise<{ job: string; expired: number }> {
  const expired = await qrPassRepository.findExpired(new Date());
  let expiredCount = 0;

  for (const pass of expired) {
    await qrPassRepository.updateStatus(pass.id, QR_STATUS.EXPIRED);
    expiredCount++;
  }

  return {
    job: "cleanup-qr",
    expired: expiredCount,
  };
}
