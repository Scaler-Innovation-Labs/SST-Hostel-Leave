import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Phase 6 (docs/movement-contract.md §7.6): reconcile legacy rows so the
// live data conforms to the contract BEFORE the enforcement code matters.
//
//  1. Settle legacy location states (APPROVED_LEAVE / CHECKED_OUT / RETURNED)
//     to the student's TRUE physical state (T2 — approval never mutates
//     location; a future/approved leave does not mean the student left).
//  2. Retire stray ACTIVE passes: never scanned + window passed → EXPIRED;
//     ACTIVE passes on non-APPROVED leaves → INVALIDATED.
//  3. Cancel overlapping APPROVED QR-capable leaves (contract §4 matrix:
//     QR × QR = reject while windows overlap), keeping the earliest per
//     student per overlapping group. Non-QR leaves are untouched (their
//     overlap is allowed) — reported, not cancelled.

async function main() {
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const {
    settleLocationState,
    resolveOverlapCancellations,
  } = await import(
    "@/services/maintenance/reconcile-legacy-data.service"
  );

  const now = new Date();
  console.log("Applying migration 0022 (reconcile legacy movement data)...");
  console.log(`  now = ${now.toISOString()}`);

  // -----------------------------------------------------
  // 1. Settle legacy location states
  // -----------------------------------------------------
  const legacyStudents = await db.execute(sql`
    SELECT s.id, s.current_location_state,
           (SELECT COUNT(*)::int FROM qr_passes qp
             WHERE qp.student_id = s.id
               AND qp.first_scan_at IS NOT NULL
               AND qp.closed_at IS NULL) AS open_sessions
    FROM students s
    WHERE s.current_location_state IN ('APPROVED_LEAVE','CHECKED_OUT','RETURNED')
    ORDER BY s.id;
  `);

  let settled = 0;
  for (const row of legacyStudents.rows as Array<{
    id: string;
    current_location_state: string;
    open_sessions: number;
  }>) {
    // The open session's leave end (for OVERDUE vs OUTSIDE_HOSTEL). If
    // multiple sessions existed (shouldn't), the latest end wins.
    const session = await db.execute(sql`
      SELECT lr.end_at
      FROM qr_passes qp
      JOIN leave_requests lr ON lr.id = qp.leave_request_id
      WHERE qp.student_id = ${row.id}
        AND qp.first_scan_at IS NOT NULL
        AND qp.closed_at IS NULL
      ORDER BY lr.end_at DESC
      LIMIT 1;
    `);
    const endAt = (session.rows[0]?.end_at as string | undefined) ?? null;
    const target = settleLocationState({
      openSessionExists: row.open_sessions > 0,
      leaveEndAt: endAt ? new Date(endAt) : null,
      now,
    });

    if (target === row.current_location_state) continue;

    await db.execute(sql`
      UPDATE students
      SET current_location_state = ${target},
          updated_at = now()
      WHERE id = ${row.id};
    `);
    console.log(
      `  [settle] student ${row.id}: ${row.current_location_state} -> ${target}` +
        (row.open_sessions > 0 ? ` (open session, end ${endAt})` : "")
    );
    settled++;
  }
  console.log(`  - settled ${settled} student(s)`);

  // -----------------------------------------------------
  // 2. Retire stray ACTIVE passes
  // -----------------------------------------------------
  // 2a. Never scanned + window passed → EXPIRED (same predicate as the
  // cleanup job, so the migration and the cron agree).
  const expired = await db.execute(sql`
    UPDATE qr_passes
    SET status = 'EXPIRED',
        closed_at = COALESCE(closed_at, now())
    WHERE status = 'ACTIVE'
      AND first_scan_at IS NULL
      AND expires_at < now()
    RETURNING id;
  `);
  console.log(`  - retired ${expired.rowCount ?? 0} never-scanned expired pass(es)`);

  // 2b. ACTIVE passes whose leave is no longer APPROVED → INVALIDATED
  // (strays from cancelled/expired/rejected legacy leaves).
  const stray = await db.execute(sql`
    UPDATE qr_passes qp
    SET status = 'INVALIDATED',
        closed_at = COALESCE(closed_at, now())
    FROM leave_requests lr
    WHERE qp.leave_request_id = lr.id
      AND qp.status = 'ACTIVE'
      AND lr.status NOT IN ('APPROVED')
    RETURNING qp.id;
  `);
  console.log(`  - invalidated ${stray.rowCount ?? 0} ACTIVE pass(es) on non-APPROVED leaves`);

  // -----------------------------------------------------
  // 3. Cancel overlapping APPROVED QR-capable leaves
  // -----------------------------------------------------
  // Only leaves whose window is still current/future can create movement
  // ambiguity. Past-window leaves are left for the cron (T6 → EXPIRED for
  // never-scanned QR leaves, T16 → COMPLETED for non-QR) so their terminal
  // status stays truthful.
  const qrLeaves = await db.execute(sql`
    SELECT lr.id, lr.student_id, lr.start_at, lr.end_at, lr.created_at,
           lt.name AS leave_type
    FROM leave_requests lr
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.status = 'APPROVED'
      AND lt.qr_mode <> 'NONE'
      AND lr.end_at >= now()
    ORDER BY lr.student_id, lr.start_at, lr.created_at;
  `);

  const candidates = (qrLeaves.rows as Array<{
    id: string;
    student_id: string;
    start_at: string;
    end_at: string;
    created_at: string;
    leave_type: string;
  }>).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    startAt: new Date(r.start_at),
    endAt: new Date(r.end_at),
    createdAt: new Date(r.created_at),
    leaveType: r.leave_type,
  }));

  const toCancel = resolveOverlapCancellations(candidates);
  const cancelledIds = new Set(toCancel);

  let cancelledCount = 0;
  for (const c of candidates) {
    if (!cancelledIds.has(c.id)) continue;
    await db.execute(sql`
      UPDATE leave_requests
      SET status = 'CANCELLED',
          cancelled_at = now(),
          current_step_key = NULL,
          current_step_order = NULL,
          updated_at = now()
      WHERE id = ${c.id};
    `);
    // Invalidate any ACTIVE pass of the cancelled leave (mirrors cancelLeave).
    await db.execute(sql`
      UPDATE qr_passes
      SET status = 'INVALIDATED',
          closed_at = COALESCE(closed_at, now())
      WHERE leave_request_id = ${c.id}
        AND status = 'ACTIVE';
    `);
    console.log(
      `  [cancel] leave ${c.id} (${c.leaveType}, ${c.startAt.toISOString()} -> ${c.endAt.toISOString()})`
    );
    cancelledCount++;
  }
  console.log(`  - cancelled ${cancelledCount} overlapping QR-capable leave(s)`);

  // Report QR × non-QR legacy overlaps (policy violation, NOT auto-cancelled —
  // non-QR leaves are valid on their own).
  const mixed = await db.execute(sql`
    WITH qr_windows AS (
      SELECT lr.student_id, lr.start_at, lr.end_at, lr.id
      FROM leave_requests lr
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.status = 'APPROVED' AND lt.qr_mode <> 'NONE'
    )
    SELECT DISTINCT lr.id, lr.student_id, lt.name AS leave_type,
           lr.start_at, lr.end_at
    FROM leave_requests lr
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    JOIN qr_windows qw ON qw.student_id = lr.student_id
      AND lt.qr_mode = 'NONE'
      AND lr.id <> qw.id
      AND lr.start_at <= qw.end_at
      AND qw.start_at <= lr.end_at
    WHERE lr.status = 'APPROVED'
    ORDER BY lr.student_id, lr.start_at;
  `);
  console.log(
    `  [report] ${mixed.rows.length} APPROVED non-QR leave(s) overlap an APPROVED QR leave ` +
      `(left intact; submit/extension policy prevents new ones)`
  );

  console.log("Migration 0022 complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
