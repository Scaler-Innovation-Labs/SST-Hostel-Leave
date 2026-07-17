import { parentOtpSessionRepository } from "@/db/repositories/parent/parent-otp-session.repository";

export async function runCleanupOtpJob() {
  const deleted = await parentOtpSessionRepository.deleteExpired(new Date());

  return {
    job: "cleanup-otp",
    deleted,
  };
}
