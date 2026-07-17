import { parentOtpSessionRepository } from "@/db/repositories/parent/parent-otp-session.repository";

export async function runCleanupOtpJob(): Promise<{ job: string; deleted: number }> {
  const deleted = await parentOtpSessionRepository.deleteExpired(new Date());

  return {
    job: "cleanup-otp",
    deleted,
  };
}
