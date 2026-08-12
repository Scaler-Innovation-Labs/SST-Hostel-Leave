import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { inArray, isNull, like } from "drizzle-orm";

import { leaveRequests, movementEvents, qrPasses, students } from "@/db";
import { db } from "@/lib/db";

async function main() {
  const overdueLeaves = await db
    .select({ id: leaveRequests.id, requestNumber: leaveRequests.requestNumber, studentId: leaveRequests.studentId })
    .from(leaveRequests)
    .where(like(leaveRequests.requestNumber, "LR-DUMMY-%RETURN-OVERDUE-%"));

  console.log(`Overdue-return leaves: ${overdueLeaves.length}`);

  const leaveIds = overdueLeaves.map((l) => l.id);

  // 1) QR passes present (findOverdueReturns predicate: firstScanAt set, closedAt null)
  const passes = await db
    .select({ id: qrPasses.id, firstScanAt: qrPasses.firstScanAt, closedAt: qrPasses.closedAt, status: qrPasses.status })
    .from(qrPasses)
    .where(inArray(qrPasses.leaveRequestId, leaveIds));
  const consistent = passes.filter((p) => p.firstScanAt && !p.closedAt && p.status === "ACTIVE");
  console.log(`  QR passes: ${passes.length} total, ${consistent.length} consistent (firstScanAt set, ACTIVE, not closed)`);

  // 2) Movement events per leave — expect LEAVE_APPROVED → EXIT_HOSTEL → AUTO_OVERDUE
  const evs = await db
    .select({ leaveRequestId: movementEvents.leaveRequestId, eventType: movementEvents.eventType, fromState: movementEvents.fromState, toState: movementEvents.toState, occurredAt: movementEvents.occurredAt })
    .from(movementEvents)
    .where(inArray(movementEvents.leaveRequestId, leaveIds))
    .orderBy(movementEvents.occurredAt);

  const byLeave = new Map<string, string[]>();
  for (const e of evs) {
    if (!e.leaveRequestId) continue;
    const list = byLeave.get(e.leaveRequestId) ?? [];
    list.push(`${e.eventType} (${e.fromState}→${e.toState})`);
    byLeave.set(e.leaveRequestId, list);
  }


  let fullTimelines = 0;
  for (const [leaveId, timeline] of byLeave) {
    const hasChain =
      timeline.some((t) => t.startsWith("LEAVE_APPROVED")) &&
      timeline.some((t) => t.startsWith("EXIT_HOSTEL")) &&
      timeline.some((t) => t.startsWith("AUTO_OVERDUE"));
    if (hasChain) fullTimelines += 1;
    else console.log(`  ⚠ Missing chain for ${leaveId}: ${timeline.join(" -> ")}`);
  }
  console.log(`  Movement events: ${evs.length} total, ${fullTimelines}/${byLeave.size} leaves with full LEAVE_APPROVED→EXIT_HOSTEL→AUTO_OVERDUE timeline`);

  // 3) Student current state
  const studentIds = [...new Set(overdueLeaves.map((l) => l.studentId))];
  const st = await db
    .select({ id: students.id, currentLocationState: students.currentLocationState })
    .from(students)
    .where(inArray(students.id, studentIds));
  const overdueStudents = st.filter((s) => s.currentLocationState === "OVERDUE");
  console.log(`  Students: ${st.length} used by overdue returns, ${overdueStudents.length} in OVERDUE state`);
  for (const s of st) {
    if (s.currentLocationState !== "OVERDUE") console.log(`    ⚠ ${s.id} is ${s.currentLocationState}`);
  }

  // 4) No orphan movement events left behind by cleanup
  const orphans = await db.select({ id: movementEvents.id }).from(movementEvents).where(isNull(movementEvents.leaveRequestId));
  console.log(`  Orphan movement events (null leaveRequestId): ${orphans.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
