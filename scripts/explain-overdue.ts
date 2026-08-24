/**
 * EXPLAIN ANALYZE the overdue-returns COUNT query (sidebar badge endpoint)
 * and the full LIST variant, to identify the expensive operation before
 * considering any index changes.
 *
 * Usage:
 *   npx tsx scripts/explain-overdue.ts
 */

import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const COUNT_SQL = `
SELECT count(*)
FROM qr_passes qp
LEFT JOIN leave_requests lr ON qp.leave_request_id = lr.id
LEFT JOIN students s        ON qp.student_id = s.id
LEFT JOIN users u           ON s.user_id = u.id
WHERE qp.first_scan_at IS NOT NULL
  AND qp.closed_at IS NULL
  AND lr.end_at < now();
`;

const LIST_SQL = `
SELECT qp.id, lr.request_number, s.roll_number, h.name
FROM qr_passes qp
LEFT JOIN leave_requests lr ON qp.leave_request_id = lr.id
LEFT JOIN leave_types lt    ON lr.leave_type_id = lt.id
LEFT JOIN students s        ON qp.student_id = s.id
LEFT JOIN users u           ON s.user_id = u.id
LEFT JOIN hostels h         ON u.hostel_id = h.id
WHERE qp.first_scan_at IS NOT NULL
  AND qp.closed_at IS NULL
  AND lr.end_at < now()
ORDER BY lr.end_at ASC
LIMIT 200;
`;

async function main() {
  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  for (const [label, query] of [
    ["COUNT (badge)", COUNT_SQL],
    ["LIST (page)", LIST_SQL],
  ] as const) {
    console.log(`\n═══ EXPLAIN ANALYZE — ${label} ═══`);
    const res = await pool.query(`EXPLAIN (ANALYZE, BUFFERS) ${query}`);
    for (const row of res.rows) {
      console.log((row as { "QUERY PLAN": string })["QUERY PLAN"]);
    }
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
