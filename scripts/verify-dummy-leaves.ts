import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { leaveRequests, leaveExtensions, users, students, leaveTypes, hostels } = await import("@/db");
  const { eq, like, inArray } = await import("drizzle-orm");

  const rows = await db
    .select({
      id: leaveRequests.id,
      leaveType: leaveTypes.code,
      hostel: hostels.code,
      status: leaveRequests.status,
      currentStep: leaveRequests.currentStepKey,
      createdAt: leaveRequests.createdAt,
    })
    .from(leaveRequests)
    .innerJoin(students, eq(leaveRequests.studentId, students.id))
    .innerJoin(users, eq(students.userId, users.id))
    .innerJoin(hostels, eq(users.hostelId, hostels.id))
    .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .where(like(leaveRequests.requestNumber, "LR-DUMMY-%"));

  const total = rows.length;
  const byHostel = new Map<string, number>();
  const pendingByStep = new Map<string, number>();
  let pending = 0;
  for (const r of rows) {
    byHostel.set(r.hostel ?? "?", (byHostel.get(r.hostel ?? "?") ?? 0) + 1);
    if (r.status === "PENDING") {
      pending += 1;
      const k = `${r.currentStep ?? "?"}`;
      pendingByStep.set(k, (pendingByStep.get(k) ?? 0) + 1);
    }
  }

  console.log(`Total LR-DUMMY leaves: ${total}`);
  console.log(`Pending: ${pending}  |  Non-pending: ${total - pending}`);
  console.log(`By hostel: ${[...byHostel.entries()].map(([h, n]) => `${h}=${n}`).join(", ")}`);
  console.log(`Pending by stage: ${[...pendingByStep.entries()].map(([s, n]) => `${s}=${n}`).join(", ")}`);
  const byStatus = new Map<string, number>();
  for (const r of rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  console.log(`By status: ${[...byStatus.entries()].map(([s, n]) => `${s}=${n}`).join(", ")}`);
  console.log(`Overdue (>24h pending): ${rows.filter((r) => r.status === "PENDING" && new Date(r.createdAt ?? 0).getTime() < Date.now() - 24 * 60 * 60 * 1000).length}`);

  // Extensions attached to dummy leaves
  const dummyLeaveIds = rows.map((r) => r.id);
  const extRows = await db
    .select({
      status: leaveExtensions.status,
      step: leaveExtensions.currentStepKey,
    })
    .from(leaveExtensions)
    .where(inArray(leaveExtensions.leaveRequestId, dummyLeaveIds));
  const extByStatus = new Map<string, number>();
  for (const e of extRows) extByStatus.set(e.status, (extByStatus.get(e.status) ?? 0) + 1);
  console.log(`Extensions: ${extRows.length} (${[...extByStatus.entries()].map(([s, n]) => `${s}=${n}`).join(", ")})`);
  const extPendingStep = new Map<string, number>();
  for (const e of extRows) {
    if (e.status === "PENDING") extPendingStep.set(e.step ?? "?", (extPendingStep.get(e.step ?? "?") ?? 0) + 1);
  }
  if (extPendingStep.size > 0) {
    console.log(`Pending extensions by step: ${[...extPendingStep.entries()].map(([s, n]) => `${s}=${n}`).join(", ")}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
