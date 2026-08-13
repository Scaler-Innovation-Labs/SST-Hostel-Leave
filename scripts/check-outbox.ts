import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { outboxEvents } = await import("@/db");
  const { notificationLogs } = await import("@/db");

  console.log("═══ OUTBOX EVENTS (outbox_events) ═══");
  const outboxByStatus = await db
    .select({ status: outboxEvents.status, count: sql<number>`count(*)` })
    .from(outboxEvents)
    .groupBy(outboxEvents.status)
    .orderBy(outboxEvents.status);
  if (outboxByStatus.length === 0) console.log("  (table is completely empty)");
  for (const row of outboxByStatus) {
    console.log(`  ${row.status}: ${row.count}`);
  }

  const pendingOutbox = await db
    .select({
      eventType: outboxEvents.eventType,
      status: outboxEvents.status,
      attemptCount: outboxEvents.attemptCount,
      lastError: outboxEvents.lastError,
      createdAt: outboxEvents.createdAt,
    })
    .from(outboxEvents)
    .where(sql`${outboxEvents.status} in ('PENDING', 'PROCESSING', 'FAILED')`)
    .orderBy(outboxEvents.createdAt)
    .limit(10);
  if (pendingOutbox.length > 0) {
    console.log("  ── unprocessed / failed events (max 10) ──");
    for (const e of pendingOutbox) {
      console.log(`  • ${e.eventType} | ${e.status} | attempts ${e.attemptCount} | ${e.createdAt?.toISOString() ?? "?"}${e.lastError ? ` | err: ${e.lastError.slice(0, 100)}` : ""}`);
    }
  }

  console.log("\n═══ NOTIFICATION LOGS (notification_logs) ═══");
  const notifByStatus = await db
    .select({ status: notificationLogs.deliveryStatus, count: sql<number>`count(*)` })
    .from(notificationLogs)
    .groupBy(notificationLogs.deliveryStatus)
    .orderBy(notificationLogs.deliveryStatus);
  if (notifByStatus.length === 0) console.log("  (table is completely empty)");
  for (const row of notifByStatus) {
    console.log(`  ${row.status}: ${row.count}`);
  }

  const notifByChannel = await db
    .select({ channel: notificationLogs.channel, status: notificationLogs.deliveryStatus, count: sql<number>`count(*)` })
    .from(notificationLogs)
    .groupBy(notificationLogs.channel, notificationLogs.deliveryStatus)
    .orderBy(notificationLogs.channel, notificationLogs.deliveryStatus);
  for (const row of notifByChannel) {
    console.log(`  [${row.channel}] ${row.status}: ${row.count}`);
  }

  const pendingNotifs = await db
    .select({
      channel: notificationLogs.channel,
      eventType: notificationLogs.eventType,
      recipient: notificationLogs.recipient,
      createdAt: notificationLogs.createdAt,
    })
    .from(notificationLogs)
    .where(sql`${notificationLogs.deliveryStatus} in ('PENDING')`)
    .orderBy(notificationLogs.createdAt)
    .limit(10);
  if (pendingNotifs.length > 0) {
    console.log("  ── pending deliveries (max 10) ──");
    for (const n of pendingNotifs) {
      console.log(`  • [${n.channel}] ${n.eventType} → ${n.recipient} | ${n.createdAt?.toISOString() ?? "?"}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
