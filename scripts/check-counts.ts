import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("@/lib/db");
  const { leaveApprovals, leaveRequests, leaveExtensions, students, users, hostels } = await import("@/db");
  const { sql, eq, and, isNotNull, isNull, lt, inArray, like } = await import("drizzle-orm");

  const hostelsRows = await db.select({ id: hostels.id, code: hostels.code }).from(hostels);
  const uni1 = hostelsRows.find((h) => h.code === "UNI-1")?.id;
  const uni2 = hostelsRows.find((h) => h.code === "UNI-2")?.id;

  // Mirrors findByFilters: count DISTINCT leaveRequestId with decision PENDING (excluding CANCELLED leaves)
  const countPending = async (hostelIds?: string[]) => {
    const conds = [
      eq(leaveApprovals.decision, "PENDING"),
      eq(leaveRequests.status, "PENDING"),
    ];
    if (hostelIds?.length) conds.push(inArray(users.hostelId, hostelIds));
    const rows = await db
      .select({ count: sql<number>`count(DISTINCT ${leaveApprovals.leaveRequestId})` })
      .from(leaveApprovals)
      .innerJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .innerJoin(students, eq(leaveRequests.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(and(...conds));
    return Number(rows[0]?.count ?? 0);
  };

  // Mirrors page default (no status): all requests
  const countAll = async (hostelIds?: string[]) => {
    const conds = [
      eq(leaveRequests.status, "PENDING"),
    ];
    if (hostelIds?.length) conds.push(inArray(users.hostelId, hostelIds));
    const rows = await db
      .select({ count: sql<number>`count(DISTINCT ${leaveApprovals.leaveRequestId})` })
      .from(leaveApprovals)
      .innerJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .innerJoin(students, eq(leaveRequests.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(and(...conds));
    return Number(rows[0]?.count ?? 0);
  };

  // Extension approvals pending (mirrors findExtensionApprovals scope: non-parent rows on extensions)
  const countExtPending = async (hostelIds?: string[]) => {
    const conds = [
      isNotNull(leaveApprovals.leaveExtensionId),
      isNull(leaveApprovals.approverParentId),
      eq(leaveApprovals.decision, "PENDING"),
    ];
    if (hostelIds?.length) conds.push(inArray(users.hostelId, hostelIds));
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(leaveApprovals)
      .innerJoin(leaveExtensions, eq(leaveApprovals.leaveExtensionId, leaveExtensions.id))
      .leftJoin(leaveRequests, eq(leaveExtensions.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conds));
    return Number(rows[0]?.count ?? 0);
  };

  // Overdue: pending approvals with leave.createdAt older than 24h (scoped)
  const countOverdue = async (hostelIds?: string[]) => {
    const conds = [
      eq(leaveApprovals.decision, "PENDING"),
      eq(leaveRequests.status, "PENDING"),
      lt(leaveRequests.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
    ];
    if (hostelIds?.length) conds.push(inArray(users.hostelId, hostelIds));
    const rows = await db
      .select({ count: sql<number>`count(DISTINCT ${leaveApprovals.leaveRequestId})` })
      .from(leaveApprovals)
      .innerJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .innerJoin(students, eq(leaveRequests.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(and(...conds));
    return Number(rows[0]?.count ?? 0);
  };

  console.log("Scopes:");
  console.log(`  UNI-1 id: ${uni1}`);
  console.log(`  UNI-2 id: ${uni2}`);
  console.log("\nADMIN (UNI-1 scope):");
  console.log(`  badge pending approvals (DISTINCT leaves): ${await countPending([uni1!])}`);
  console.log(`  approvals page total (all requests):        ${await countAll([uni1!])}`);
  console.log(`  extension approvals pending (rows):         ${await countExtPending([uni1!])}`);
  console.log(`  overdue pending (>24h):                     ${await countOverdue([uni1!])}`);
  console.log("\nSUPER-ADMIN (ALL):");
  console.log(`  badge pending approvals (DISTINCT leaves): ${await countPending()}`);
  console.log(`  approvals page total (all requests):        ${await countAll()}`);
  console.log(`  extension approvals pending (rows):         ${await countExtPending()}`);
  console.log(`  overdue pending (>24h):                     ${await countOverdue()}`);
  console.log(`  UNI-2 only pending approvals:               ${await countPending([uni2!])}`);

  const dummyCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(leaveRequests)
    .where(like(leaveRequests.requestNumber, "LR-DUMMY-%"));
  console.log(`\nLR-DUMMY leaves total: ${Number(dummyCount[0]?.count ?? 0)}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
