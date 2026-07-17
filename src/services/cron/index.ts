import { logger } from "@/lib/logger";

import { runCleanupOtpJob } from "./cleanup-otp.job";
import { runCleanupQrJob } from "./cleanup-qr.job";
import { runExpireLeavesJob } from "./expire-leaves.job";
import { runMarkOverdueJob } from "./mark-overdue.job";
import { runRetryOutboxJob } from "./retry-outbox.job";

type CronResult = {
  job: string;
  [key: string]: unknown;
};

type CronSummary = {
  totalTime: number;
  results: CronResult[];
  hasErrors: boolean;
};

export async function runAllCronJobs(): Promise<CronSummary> {
  const start = Date.now();
  const results: CronResult[] = [];

  const jobs = [
    { name: "Expire Leaves", fn: runExpireLeavesJob },
    { name: "Mark Overdue", fn: runMarkOverdueJob },
    { name: "Retry Outbox", fn: runRetryOutboxJob },
    { name: "Cleanup OTP", fn: runCleanupOtpJob },
    { name: "Cleanup QR", fn: runCleanupQrJob },
  ];

  let hasErrors = false;

  for (const { name, fn } of jobs) {
    try {
      logger.info(`Cron job started: ${name}`);
      const result = await fn();
      results.push(result);
      logger.info(`Cron job completed: ${name}`, result);
    } catch (error) {
      hasErrors = true;
      const message = error instanceof Error ? error.message : String(error);
      results.push({ job: name.toLowerCase().replace(/\s+/g, "-"), error: message });
      logger.error(`Cron job failed: ${name}`, { error: message });
    }
  }

  return {
    totalTime: Date.now() - start,
    results,
    hasErrors,
  };
}
