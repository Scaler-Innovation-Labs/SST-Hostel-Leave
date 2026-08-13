import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { processPendingEvents } = await import("@/services/outbox/outbox-worker.service");
  const result = await processPendingEvents();
  console.log("Worker result:", JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });