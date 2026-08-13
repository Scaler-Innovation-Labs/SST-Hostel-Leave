import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { notificationRules, notificationTemplates, notificationRuleRecipients, notificationRuleChannels } =
    await import("@/db");
  const { eq, isNull } = await import("drizzle-orm");

  const rules = await db
    .select()
    .from(notificationRules)
    .where(isNull(notificationRules.leaveTypeId));
  console.log("Global rules:", rules.length);

  for (const rule of rules) {
    const template = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, rule.templateId));
    const recipients = await db
      .select()
      .from(notificationRuleRecipients)
      .where(eq(notificationRuleRecipients.ruleId, rule.id));
    const channels = await db
      .select()
      .from(notificationRuleChannels)
      .where(eq(notificationRuleChannels.ruleId, rule.id));
    console.log("  Rule:", rule.eventType, "template:", template[0]?.code,
      "recipients:", recipients.map((r) => r.recipientType).join(","),
      "channels:", channels.map((c) => c.channel).join(","));
  }
}

main()
  .catch((e) => {
    console.error("Verify failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));