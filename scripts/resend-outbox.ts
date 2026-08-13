import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const LEAVE_IDS = process.argv.slice(2);
const EVENT_TYPES = process.argv.length > 2 ? ["LEAVE_CREATED"] : ["LEAVE_CREATED"];

async function main() {
  if (LEAVE_IDS.length === 0) {
    console.error("usage: tsx scripts/resend-outbox.ts <leaveId> [leaveId ...]");
    process.exit(1);
  }

  const { db } = await import("@/lib/db");
  const { inArray } = await import("drizzle-orm");
  const { outboxEvents } = await import("@/db");

  const rows = await db
    .select({
      id: outboxEvents.id,
      eventType: outboxEvents.eventType,
      aggregateId: outboxEvents.aggregateId,
      status: outboxEvents.status,
      attemptCount: outboxEvents.attemptCount,
      lastError: outboxEvents.lastError,
    })
    .from(outboxEvents)
    .where(inArray(outboxEvents.aggregateId, LEAVE_IDS));

  if (rows.length === 0) {
    console.log("No outbox events found for the given leave ids.");
    return;
  }

  const toReset = rows.filter(
    (r) =>
      EVENT_TYPES.includes(r.eventType) && r.status !== "PENDING"
  );

  if (toReset.length === 0) {
    console.log("No events to reset (already pending or unmatched).");
    for (const r of rows) {
      console.log(`  ${r.eventType} | ${r.aggregateId} | ${r.status} | attempts ${r.attemptCount}`);
    }
    return;
  }

  const ids = toReset.map((r) => r.id);
  await db
    .update(outboxEvents)
    .set({
      status: "PENDING",
      attemptCount: 0,
      lastError: null,
      processedAt: null,
    })
    .where(inArray(outboxEvents.id, ids));

  console.log(`Reset ${ids.length} event(s) to PENDING:`);
  for (const r of toReset) {
    console.log(`  ${r.eventType} | ${r.aggregateId} | ${r.status} -> PENDING`);
  }
  console.log("\nThe outbox cron (every 5 min) will re-process them, or hit POST /api/v1/outbox/process.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });