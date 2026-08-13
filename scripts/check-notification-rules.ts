import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { notificationRules, notificationRuleRecipients, notificationRuleChannels, leaveTypes } = await import("@/db");
  const rows = await db
    .select({
      id: notificationRules.id,
      eventType: notificationRules.eventType,
      leaveTypeCode: leaveTypes.code,
      enabled: notificationRules.enabled,
    })
    .from(notificationRules)
    .leftJoin(leaveTypes, eq(notificationRules.leaveTypeId, leaveTypes.id));
  const out = [];
  for (const rule of rows) {
    const recipients = await db
      .select({ recipientType: notificationRuleRecipients.recipientType })
      .from(notificationRuleRecipients)
      .where(eq(notificationRuleRecipients.ruleId, rule.id));
    const channels = await db
      .select({ channel: notificationRuleChannels.channel })
      .from(notificationRuleChannels)
      .where(eq(notificationRuleChannels.ruleId, rule.id));
    out.push({ ...rule, recipients: recipients.map((r) => r.recipientType), channels: channels.map((c) => c.channel) });
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});