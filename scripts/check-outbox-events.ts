import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { outboxEvents } = await import("@/db");

  const rows = await db
    .select({
      eventType: outboxEvents.eventType,
      aggregateId: outboxEvents.aggregateId,
      status: outboxEvents.status,
      createdAt: outboxEvents.createdAt,
    })
    .from(outboxEvents)
    .orderBy(outboxEvents.createdAt);

  console.log(`Total outbox events: ${rows.length}`);
  for (const r of rows) {
    console.log(`  ${r.createdAt?.toISOString() ?? "?"} | ${r.eventType} | ${r.aggregateId} | ${r.status}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
