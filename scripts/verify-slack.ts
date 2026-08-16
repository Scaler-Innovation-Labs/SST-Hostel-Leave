import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { inArray } = await import("drizzle-orm");
  const { notificationLogs } = await import("@/db");

  const LEAVE_IDS = ["e855a265-2671-4b08-822e-83d40ffbc46e", "dd293514-1d95-450e-b6d2-103af9e30128"];

  const logs = await db
    .select({
      id: notificationLogs.id,
      recipient: notificationLogs.recipient,
      deliveryStatus: notificationLogs.deliveryStatus,
      providerMessageId: notificationLogs.providerMessageId,
      createdAt: notificationLogs.createdAt,
    })
    .from(notificationLogs)
    .where(inArray(notificationLogs.leaveRequestId, LEAVE_IDS));
  console.log("═══ LOGS ═══");
  for (const l of logs) console.log(JSON.stringify(l));

  const { WebClient } = await import("@slack/web-api");
  const client = new WebClient(process.env.SLACK_BOT_TOKEN);

  console.log("\n═══ CHANNELS THE BOT IS A MEMBER OF (matching leave-hostel) ═══");
  const list = await client.conversations.list({
    types: "public_channel,private_channel",
    limit: 200,
  });
  const channels = list.channels ?? [];
  const matches = channels.filter(
    (c) => (c.name ?? "").toLowerCase().includes("leave-hostel") || (c.id ?? "").includes("leave-hostel")
  );
  for (const c of matches) console.log(`${c.id} | ${c.name} | ${c.is_private ? "private" : "public"} | member=${c.is_member ?? "?"}`);

  const target = matches.find((c) => c.name === "leave-hostel-poc");
  if (target) {
    const ts = logs.find((l) => l.deliveryStatus === "SENT")?.providerMessageId?.replace("slack-", "");
    console.log(`\n═══ CONVERSATION HISTORY: ${target.name} (${target.id}), latest=${ts ?? "none"} ═══`);
    const history = await client.conversations.history({
      channel: target.id ?? "",
      ...(ts ? { latest: ts, limit: 5 } : { limit: 5 }),
    });
    for (const m of history.messages ?? []) {
      console.log(`${m.ts} | ${m.subtype ?? "message"} | ${m.username ?? m.bot_id ?? m.user ?? "?"}: ${JSON.stringify(m.text ?? "").slice(0, 120)}`);
    }
  } else {
    console.log("\nBot is not a member of any channel named 'leave-hostel-poc'");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });