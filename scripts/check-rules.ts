import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const LEAVE_TYPE_ID = "dc7daf27-b48e-498c-8ada-5a650ac40758";
const SLACK_TEMPLATE_IDS = [
  "fc1db40f-9f6b-4736-9501-af1edcc64efd", // leave_submitted_slack_late_stay_poc
  "466d3219-cab5-443d-b2b0-0c027f3bba2f", // leave_submitted_slack_late_stay_admin
];

async function main() {
  const { db } = await import("@/lib/db");
  const { eq, inArray, isNull } = await import("drizzle-orm");
  const {
    notificationRules,
    notificationRuleChannels,
    notificationRuleRecipients,
    leaveTypes,
  } = await import("@/db");

  const lt = await db.select().from(leaveTypes).where(eq(leaveTypes.id, LEAVE_TYPE_ID));
  console.log("═══ LEAVE TYPE ═══");
  console.log(JSON.stringify(lt, null, 2));

  console.log("\n═══ ALL RULES FOR THIS LEAVE TYPE ═══");
  const rules = await db
    .select()
    .from(notificationRules)
    .where(eq(notificationRules.leaveTypeId, LEAVE_TYPE_ID));
  for (const r of rules) console.log(JSON.stringify(r, null, 2));

  console.log("\n═══ RULES REFERENCING THE TWO LATE_STAY SLACK TEMPLATES (any leave type) ═══");
  const rules2 = await db
    .select()
    .from(notificationRules)
    .where(inArray(notificationRules.templateId, SLACK_TEMPLATE_IDS));
  for (const r of rules2) console.log(JSON.stringify(r, null, 2));

  console.log("\n═══ CHANNELS + RECIPIENTS FOR RULES ABOVE/ALL ═══");
  const allRuleIds = [...new Set([...rules, ...rules2].map((r) => r.id))];
  for (const ruleId of allRuleIds) {
    const ch = await db
      .select({ channel: notificationRuleChannels.channel })
      .from(notificationRuleChannels)
      .where(eq(notificationRuleChannels.ruleId, ruleId));
    const rc = await db
      .select({ recipientType: notificationRuleRecipients.recipientType })
      .from(notificationRuleRecipients)
      .where(eq(notificationRuleRecipients.ruleId, ruleId));
    console.log(`rule ${ruleId}: channels=${ch.map((c) => c.channel).join(",")} recipients=${rc.map((c) => c.recipientType).join(",")}`);
  }

  console.log("\n═══ GLOBAL RULES (leaveTypeId null) for LEAVE_SUBMITTED ═══");
  const globals = await db
    .select()
    .from(notificationRules)
    .where(isNull(notificationRules.leaveTypeId));
  for (const r of globals) console.log(JSON.stringify(r, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });