import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.production") });

async function main() {
  const { db } = await import("@/lib/db");
  const { sql, eq } = await import("drizzle-orm");
  const { outboxEvents, leaveApprovalParentDetails } = await import("@/db");
  const { processPendingEvents } = await import("@/services/outbox/outbox-worker.service");

  const mode = process.argv[2] ?? "STATUS";

  const pending = await db.execute(sql`
    SELECT
      le.id as extension_id,
      le.leave_request_id,
      le.extension_number,
      le.status as ext_status,
      u.full_name as student_name,
      p.id as parent_id,
      p.name as parent_name,
      p.phone as parent_phone,
      la.id as parent_approval_id,
      la.decision as parent_approval_decision,
      lapd.token_expires_at,
      CASE WHEN lapd.token_hash IS NOT NULL THEN true ELSE false END as has_token_hash,
      oe.id as outbox_event_id,
      oe.status as outbox_status,
      oe.attempt_count as outbox_attempts,
      oe.last_error as outbox_error
    FROM leave_extensions le
    JOIN leave_requests lr ON le.leave_request_id = lr.id
    JOIN students s ON lr.student_id = s.id
    JOIN users u ON s.user_id = u.id
    LEFT JOIN parents p ON p.student_id = s.id AND p.is_primary = true
    LEFT JOIN leave_approvals la ON la.leave_extension_id = le.id AND la.step_key = 'PARENT_APPROVAL'
    LEFT JOIN leave_approval_parent_details lapd ON lapd.approval_id = la.id
    LEFT JOIN outbox_events oe ON oe.aggregate_id = le.id AND oe.event_type = 'PARENT_APPROVAL_REQUIRED'
    WHERE le.status = 'PENDING'
    ORDER BY le.created_at DESC
  `);

  console.log(`Found ${pending.rows.length} pending extensions:`);
  for (const r of pending.rows as any[]) {
    console.log(`- ${r.student_name}: ExtID=${r.extension_id}, Parent=${r.parent_name} (${r.parent_phone}), Token=${r.has_token_hash ? 'VALID' : 'NULL'}, Outbox=${r.outbox_status} (attempts: ${r.outbox_attempts})`);
  }

  if (mode === "ALL") {
    console.log("\nProcessing all pending extensions that lack valid tokens or have failed outbox events...");

    for (const r of pending.rows as any[]) {
      if (r.has_token_hash && r.outbox_status === "PROCESSED") {
        console.log(`Skipping ${r.student_name} - already has valid token and processed outbox.`);
        continue;
      }

      console.log(`Resetting and preparing ${r.student_name} (${r.extension_id})...`);
      // Reset parent details token
      if (r.parent_approval_id) {
        await db
          .update(leaveApprovalParentDetails)
          .set({
            tokenHash: null,
            tokenExpiresAt: null,
          })
          .where(eq(leaveApprovalParentDetails.approvalId, r.parent_approval_id));
      }

      // Reset outbox event
      if (r.outbox_event_id) {
        await db
          .update(outboxEvents)
          .set({
            status: "PENDING",
            attemptCount: 0,
            lastError: null,
            processedAt: null,
          })
          .where(eq(outboxEvents.id, r.outbox_event_id));
      }
    }

    console.log("\nTriggering outbox processing...");
    const res = await processPendingEvents();
    console.log("Outbox processing result:", res);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
