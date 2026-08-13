import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { notificationLogs } = await import("@/db");

  const rows = await db
    .select({
      channel: notificationLogs.channel,
      eventType: notificationLogs.eventType,
      recipient: notificationLogs.recipient,
      deliveryStatus: notificationLogs.deliveryStatus,
      providerResponse: notificationLogs.providerResponse,
      providerMessageId: notificationLogs.providerMessageId,
      metadata: notificationLogs.metadata,
      createdAt: notificationLogs.createdAt,
    })
    .from(notificationLogs)
    .where(sql`${notificationLogs.deliveryStatus} = 'FAILED'`)
    .orderBy(notificationLogs.createdAt)
    .limit(20);

  console.log(`Failed notifications: ${rows.length}`);
  for (const r of rows) {
    console.log("─".repeat(60));
    console.log(`[${r.channel}] ${r.eventType} → ${r.recipient} | ${r.createdAt?.toISOString() ?? "?"}`);
    console.log(`  providerResponse: ${r.providerResponse ?? "(none)"}`);
    console.log(`  providerMessageId: ${r.providerMessageId ?? "(none)"}`);
    console.log(`  metadata: ${JSON.stringify(r.metadata)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
