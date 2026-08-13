import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { eq, inArray } = await import("drizzle-orm");
  const { notificationRules } = await import("@/db/schema/notification-rules");
  const { notificationTemplates } = await import("@/db/schema/notification");
  const { notificationRuleRecipients, notificationRuleChannels } = await import(
    "@/db/schema/notification-rules"
  );
  const { leaveTypes } = await import("@/db/schema/leave");

  const rules = await db
    .select({
      id: notificationRules.id,
      eventType: notificationRules.eventType,
      leaveTypeId: notificationRules.leaveTypeId,
      templateId: notificationRules.templateId,
      enabled: notificationRules.enabled,
    })
    .from(notificationRules)
    .where(eq(notificationRules.eventType, "LEAVE_APPROVAL_REQUIRED"));

  if (rules.length === 0) {
    console.log("FAIL: no LEAVE_APPROVAL_REQUIRED rules found");
    process.exit(1);
  }

  const ruleIds = rules.map((r) => r.id);
  const [recipients, channels, templates, leaveTypeRows] = await Promise.all([
    db
      .select()
      .from(notificationRuleRecipients)
      .where(inArray(notificationRuleRecipients.ruleId, ruleIds)),
    db
      .select()
      .from(notificationRuleChannels)
      .where(inArray(notificationRuleChannels.ruleId, ruleIds)),
    db
      .select()
      .from(notificationTemplates)
      .where(
        inArray(
          notificationTemplates.id,
          rules.map((r) => r.templateId)
        )
      ),
    db
      .select()
      .from(leaveTypes)
      .where(
        inArray(
          leaveTypes.id,
          rules.map((r) => r.leaveTypeId).filter((id): id is string => !!id)
        )
      ),
  ]);

  const templateByCode = new Map(templates.map((t) => [t.id, t.code]));
  const typeByCode = new Map(leaveTypeRows.map((t) => [t.id, t.code]));

  let found = false;
  for (const rule of rules) {
    const ruleRecipients = recipients
      .filter((r) => r.ruleId === rule.id)
      .map((r) => r.recipientType);
    const ruleChannels = channels
      .filter((c) => c.ruleId === rule.id)
      .map((c) => c.channel);
    console.log(
      `- ${typeByCode.get(rule.leaveTypeId ?? "") ?? "GLOBAL"} | ${rule.eventType} | ${templateByCode.get(rule.templateId) ?? "?"} | recipients=[${ruleRecipients}] | channels=[${ruleChannels}] | enabled=${rule.enabled}`
    );
    if (
      typeByCode.get(rule.leaveTypeId ?? "") === "LATE_STAY_COLLEGE" &&
      templateByCode.get(rule.templateId) === "leave_submitted_slack_late_stay_admin" &&
      ruleRecipients.includes("HOSTEL_ADMIN") &&
      ruleChannels.includes("SLACK") &&
      rule.enabled
    ) {
      found = true;
    }
  }

  if (!found) {
    console.log("FAIL: late-stay admin-review rule is not wired correctly");
    process.exit(1);
  }
  console.log("OK: late-stay admin-review rule wired");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
