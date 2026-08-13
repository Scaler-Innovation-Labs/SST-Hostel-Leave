import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import {
  leaveTypes as leaveTypesTable,
  notificationRuleChannels,
  notificationRuleRecipients,
  notificationRules,
  notificationTemplates,
} from "@/db";
import { db } from "@/lib/db";

async function main() {
  const rows = await db
    .select({
      ruleId: notificationRules.id,
      eventType: notificationRules.eventType,
      enabled: notificationRules.enabled,
      templateCode: notificationTemplates.code,
      leaveTypeCode: leaveTypesTable.code,
    })
    .from(notificationRules)
    .innerJoin(leaveTypesTable, eq(notificationRules.leaveTypeId, leaveTypesTable.id))
    .innerJoin(notificationTemplates, eq(notificationRules.templateId, notificationTemplates.id));

  const recipients = await db.select().from(notificationRuleRecipients);
  const channels = await db.select().from(notificationRuleChannels);
  const recipientByRule = new Map<string, string[]>();
  for (const r of recipients) {
    const list = recipientByRule.get(r.ruleId) ?? [];
    list.push(r.recipientType);
    recipientByRule.set(r.ruleId, list);
  }
  const channelByRule = new Map<string, string[]>();
  for (const c of channels) {
    const list = channelByRule.get(c.ruleId) ?? [];
    list.push(c.channel);
    channelByRule.set(c.ruleId, list);
  }

  for (const row of rows.sort((a, b) => a.leaveTypeCode.localeCompare(b.leaveTypeCode))) {
    const recips = (recipientByRule.get(row.ruleId) ?? []).join(",");
    const chans = (channelByRule.get(row.ruleId) ?? []).join(",");
    if (row.eventType === "LEAVE_SUBMITTED" || row.eventType === "LEAVE_APPROVAL_REQUIRED" || row.eventType === "LEAVE_POC_REVIEW_REQUIRED") {
      console.log(
        `${row.leaveTypeCode.padEnd(20)} | ${row.eventType.padEnd(26)} | ${recips.padEnd(12)} | ${chans.padEnd(6)} | ${row.templateCode}`
      );
    }
  }

  console.log("\nTotal staff-alert rules:");
  const staff = rows.filter((r) => ["LEAVE_SUBMITTED", "LEAVE_APPROVAL_REQUIRED", "LEAVE_POC_REVIEW_REQUIRED"].includes(r.eventType));
  console.log(`  LEAVE_SUBMITTED: ${staff.filter((r) => r.eventType === "LEAVE_SUBMITTED").length}`);
  console.log(`  LEAVE_POC_REVIEW_REQUIRED: ${staff.filter((r) => r.eventType === "LEAVE_POC_REVIEW_REQUIRED").length}`);
  console.log(`  LEAVE_APPROVAL_REQUIRED: ${staff.filter((r) => r.eventType === "LEAVE_APPROVAL_REQUIRED").length}`);

  const pocTemplates = await db
    .select({ code: notificationTemplates.code })
    .from(notificationTemplates)
    .where(eq(notificationTemplates.code, "leave_submitted_slack_marriage_poc"));
  console.log(`\nmarriage POC template present: ${pocTemplates.length > 0}`);
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit());
