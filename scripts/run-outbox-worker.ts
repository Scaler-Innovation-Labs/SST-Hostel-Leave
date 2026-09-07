import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// One drain pass of the outbox, run on a short interval by the worker host
// (systemd timer). Uses runRetryOutboxJob so each pass is self-healing:
// it requeues events stuck in PROCESSING (crashed mid-run), resets FAILED
// events that still have retry budget, then claims and processes PENDING
// rows straight from the DB. No SQS involved.
async function main() {
  const { runRetryOutboxJob } = await import("@/services/cron/retry-outbox.job");
  const result = await runRetryOutboxJob();
  console.log("Outbox drain result:", JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
