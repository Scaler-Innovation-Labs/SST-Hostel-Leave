import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const LEAVE_ID = process.argv[2] ?? "e855a265-2671-4b08-822e-83d40ffbc46e";

async function main() {
  const { db } = await import("@/lib/db");
  const { eq } = await import("drizzle-orm");
  const {
    leaveRequests,
    notificationLogs,
    outboxEvents,
    notificationTemplates,
    notificationRules,
    hostels,
    students,
    users,
    leaveApprovals,
  } = await import("@/db");

  const leave = await db
    .select()
    .from(leaveRequests)
    .where(eq(leaveRequests.id, LEAVE_ID));
  console.log("═══ LEAVE ═══");
  console.log(JSON.stringify(leave, null, 2));
  if (leave.length === 0) return;
  const l = leave[0]!;

  const studentRows = await db
    .select({ studentId: students.id, userId: students.userId })
    .from(students)
    .where(eq(students.id, l.studentId));
  if (studentRows[0]) {
    const studentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, studentRows[0].userId));
    const hostelId = studentUser[0]?.hostelId ?? null;
    if (hostelId) {
      const h = await db
        .select()
        .from(hostels)
        .where(eq(hostels.id, hostelId));
      console.log("\n═══ HOSTEL (from student → user) ═══");
      console.log(JSON.stringify(h, null, 2));
    }
  }

  const approvals = await db
    .select({ approverUserId: leaveApprovals.approverUserId, stepKey: leaveApprovals.stepKey, decision: leaveApprovals.decision, stepOrder: leaveApprovals.stepOrder })
    .from(leaveApprovals)
    .where(eq(leaveApprovals.leaveRequestId, LEAVE_ID))
    .orderBy(leaveApprovals.stepOrder);
  console.log("\n═══ APPROVALS ═══");
  console.log(JSON.stringify(approvals, null, 2));

  console.log("\n═══ NOTIFICATION LOGS FOR THIS LEAVE (all channels) ═══");
  const notifLogs = await db
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.leaveRequestId, LEAVE_ID))
    .orderBy(notificationLogs.createdAt);
  for (const n of notifLogs) {
    console.log(JSON.stringify(n, null, 2));
  }

  console.log("\n═══ OUTBOX EVENTS FOR THIS LEAVE ═══");
  const outbox = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.aggregateId, LEAVE_ID))
    .orderBy(outboxEvents.createdAt);
  for (const o of outbox) {
    console.log(JSON.stringify(o, null, 2));
  }

  const templates = await db
    .select({
      id: notificationTemplates.id,
      code: notificationTemplates.code,
      eventKey: notificationTemplates.eventKey,
      channel: notificationTemplates.channel,
      leaveTypeId: notificationTemplates.leaveTypeId,
      isActive: notificationTemplates.isActive,
    })
    .from(notificationTemplates)
    .where(eq(notificationTemplates.channel, "SLACK"));
  console.log("\n═══ ALL SLACK TEMPLATES ═══");
  console.log(JSON.stringify(templates, null, 2));

  if (templates.length) {
    const rules = await db
      .select()
      .from(notificationRules)
      .where(eq(notificationRules.templateId, templates[0]!.id));
    console.log("\n═══ RULES (sample: 1st slack template) ═══");
    console.log(JSON.stringify(rules, null, 2));
  }

  console.log("\n═══ SLACK ENV (presence only) ═══");
  console.log({
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ? "SET" : "MISSING",
    SLACK_CHANNEL_ID: process.env.SLACK_CHANNEL_ID ? "SET" : "MISSING",
    SLACK_POC_CHANNEL_ID: process.env.SLACK_POC_CHANNEL_ID ? "SET" : "MISSING",
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });