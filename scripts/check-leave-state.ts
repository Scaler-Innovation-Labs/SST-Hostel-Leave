import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });

const LEAVE_ID = process.argv[2] ?? "dd293514-1d95-450e-b6d2-103af9e30128";

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const url = new URL(raw);
  url.searchParams.delete("channel_binding");
  url.searchParams.set("connect_timeout", "15");

  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 20000 });
  await client.connect();

  const leave = await client.query(
    `SELECT lr.id, lr.request_number, lr.status, lr.current_step_key, lr.current_step_order, lr.submitted_at, lr.updated_at,
            lt.name AS leave_type, lt.code AS leave_type_code,
            u.full_name AS student_name
     FROM leave_requests lr
     LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
     LEFT JOIN students s ON s.id = lr.student_id
     LEFT JOIN users u ON u.id = s.user_id
     WHERE lr.id = $1`,
    [LEAVE_ID],
  );
  console.log("LEAVE:", JSON.stringify(leave.rows[0] ?? null, null, 2));

  const approvals = await client.query(
    `SELECT la.id, la.step_key, la.step_order, la.decision, la.comments,
            la.approver_user_id, u.full_name AS approver_name,
            la.approver_role_id
     FROM leave_approvals la
     LEFT JOIN users u ON u.id = la.approver_user_id
     WHERE la.leave_request_id = $1
     ORDER BY la.step_order`,
    [LEAVE_ID],
  );
  console.log("APPROVALS:", JSON.stringify(approvals.rows, null, 2));

  const events = await client.query(
    `SELECT id, event_type, status, created_at FROM outbox_events WHERE aggregate_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [LEAVE_ID],
  );
  console.log("OUTBOX EVENTS:", JSON.stringify(events.rows, null, 2));

  const logs = await client.query(
    `SELECT id, event_type, channel, delivery_status, provider_response, recipient, created_at
     FROM notification_logs
     WHERE leave_request_id = $1
     ORDER BY created_at DESC LIMIT 20`,
    [LEAVE_ID],
  );
  console.log("NOTIFICATION LOGS:", JSON.stringify(logs.rows, null, 2));

  await client.end();
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});
