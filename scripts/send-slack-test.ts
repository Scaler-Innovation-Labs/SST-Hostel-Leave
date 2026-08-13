import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const LEAVE_ID = process.argv[2];

async function main() {
  const { createSlackProvider } = await import(
    "@/services/notification/providers/slack.provider"
  );
  const { db } = await import("@/lib/db");
  const { eq } = await import("drizzle-orm");
  const { leaveRequests, students, users, hostels, leaveTypes } = await import(
    "@/db"
  );

  const missing = Object.entries({
    leaveRequests,
    students,
    users,
    hostels,
    leaveTypes,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    console.error("Tables not exported from @/db:", missing.join(", "));
    process.exit(1);
  }

  let subject = "🧾 TEST LEAVE SUBMITTED";
  let body =
    "This is a test notification posted by `scripts/send-slack-test.ts`. If you can read this, the channel is configured correctly.";
  let metadata: Record<string, string> = {
    "Test ID": Date.now().toString(),
  };
  let hostelChannel: string | null = null;

  if (LEAVE_ID) {
    const sel = {
      requestNumber: leaveRequests.requestNumber,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      startAt: leaveRequests.startAt,
      endAt: leaveRequests.endAt,
      submittedAt: leaveRequests.submittedAt,
      studentName: users.fullName,
      rollNumber: students.rollNumber,
      hostelName: hostels.name,
      hostelChannel: hostels.slackChannelId,
      leaveTypeName: leaveTypes.name,
    };
    const rows = await db
      .select(sel)
      .from(leaveRequests)
      .innerJoin(students, eq(students.id, leaveRequests.studentId))
      .innerJoin(users, eq(users.id, students.userId))
      .leftJoin(hostels, eq(hostels.id, users.hostelId))
      .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
      .where(eq(leaveRequests.id, LEAVE_ID))
      .limit(1);

    const row = rows[0];
    if (!row) throw new Error(`Leave not found: ${LEAVE_ID}`);

    subject = "🧾 LEAVE SUBMITTED — POC REVIEW";
    body = `*${row.studentName}* (${row.rollNumber}) has submitted a leave request that requires your review.`;
    metadata = {
      "Request Number": row.requestNumber,
      "Leave Type": row.leaveTypeName,
      Student: row.studentName,
      "Roll Number": row.rollNumber,
      Hostel: row.hostelName ?? "—",
      Reason: row.reason,
      From: row.startAt.toISOString(),
      To: row.endAt.toISOString(),
      "Submitted At": row.submittedAt.toISOString(),
      Status: row.status,
    };
    hostelChannel = row.hostelChannel ?? null;
  }

  const channels = [
    { label: "SLACK_CHANNEL_ID (main)", value: process.env.SLACK_CHANNEL_ID },
    {
      label: "SLACK_POC_CHANNEL_ID (POC)",
      value: process.env.SLACK_POC_CHANNEL_ID,
    },
    { label: "hostels.slackChannelId (hostel)", value: hostelChannel },
  ].filter((c) => c.value);

  if (channels.length === 0) {
    console.error("No Slack channels configured.");
    process.exit(1);
  }

  const provider = createSlackProvider();
  for (const channel of channels) {
    console.log(`\n--- Sending to ${channel.label}: ${channel.value} ---`);
    const result = await provider.send({
      to: channel.value as string,
      subject,
      body,
      metadata,
    });
    console.log(
      result.success
        ? `✅ ${channel.value} -> ${result.messageId}`
        : `❌ ${channel.value} -> ${result.error}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });