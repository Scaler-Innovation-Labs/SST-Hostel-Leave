import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * One-shot SQS recovery publisher. Claims PENDING outbox rows that never
 * reached SQS (plus stale published-but-unprocessed rows) and publishes
 * them. Safe to run on a loop (e.g. EC2 systemd timer) — claiming only
 * pushes `next_attempt_at` out, so concurrent runs skip each other.
 */
async function main() {
  const { runPublishOutboxJob } = await import(
    "@/services/cron/publish-outbox.job"
  );
  const result = await runPublishOutboxJob();
  console.log("Publish result:", JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
