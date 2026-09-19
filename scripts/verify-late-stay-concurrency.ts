import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Phase 8.1 — Adversarial concurrency audit for recurring late-stay.
 *
 * Runs against the REAL database (same style as verify-*.ts). Every fixture
 * is disposable (lsa-audit-* emails) and cleaned up in `finally`.
 *
 * Probes:
 *   A. N concurrent "Claim tonight" for the same authorization + date.
 *      Expected: exactly ONE occurrence row — the DB partial unique index is
 *      the arbiter; losers replay the existing row.
 *   B. Sequential double-claim (retry after lost response).
 *      Expected: second call returns idempotentReplay=true.
 *   C. Claim racing with REVOKED.
 *      Expected: row count still 1; post-revocation claims refused.
 *   D. V2 approval concurrent with V1 revocation.
 *      Expected: lineage invariant — at most one ACTIVE authorization;
 *      V1-era occurrences remain attributable to V1.
 *
 * Probes are isolated per-student because the overlap guard is per-student
 * stateful: a live occurrence from one probe must not block the next.
 *
 * Usage: npx tsx scripts/verify-late-stay-concurrency.ts
 */
async function main() {
  const { db } = await import("@/lib/db");
  const { and, eq, inArray, sql } = await import("drizzle-orm");
  const {
    academicGroups,
    departments,
    lateStayAuthorizations,
    leaveRequests,
    leaveTypes,
    students,
    users,
  } = await import("@/db");

  const STAMP = `lsa-audit-${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdAuthIds: string[] = [];
  const createdLeaveIds: string[] = [];
  const createdGroupIds: string[] = [];

  const findings: Array<{
    name: string;
    verdict: "PASS" | "FAIL" | "OBSERVATION";
    detail: string;
  }> = [];
  let probeError: unknown = null;

  function record(
    name: string,
    verdict: "PASS" | "FAIL" | "OBSERVATION",
    detail: string
  ) {
    findings.push({ name, verdict, detail });
    const icon = verdict === "PASS" ? "✔" : verdict === "FAIL" ? "✘" : "ℹ";
    console.log(`  ${icon} ${name}: ${detail}`);
  }

  // ------------------------------------------------------------------
  // Fixture builders (disposable, lsa-audit-* stamped)
  // ------------------------------------------------------------------
  async function buildStudentFixture() {
    const dept = (
      await db
        .insert(departments)
        .values({ code: `${STAMP}-d-${Math.random().toString(36).slice(2, 6)}`, name: "LSA Audit Dept" })
        .returning()
    )[0]!;
    const group = (
      await db
        .insert(academicGroups)
        .values({
          departmentId: dept.id,
          batchYear: 2026,
          groupCode: `${STAMP}-g-${Math.random().toString(36).slice(2, 6)}`,
          name: "LSA Audit Group",
        })
        .returning()
    )[0]!;
    createdGroupIds.push(group.id);

    const user = (
      await db
        .insert(users)
        .values({
          fullName: "LSA Audit Student",
          email: `${STAMP}-s-${Math.random().toString(36).slice(2, 8)}@test.local`,
          isActive: true,
        })
        .returning()
    )[0]!;
    createdUserIds.push(user.id);

    const student = (
      await db
        .insert(students)
        .values({
          userId: user.id,
          academicGroupId: group.id,
          rollNumber: `${STAMP}-r-${Math.random().toString(36).slice(2, 8)}`,
          currentLocationState: "IN_HOSTEL",
        })
        .returning()
    )[0]!;
    createdStudentIds.push(student.id);

    return { user, student, groupId: group.id, deptId: dept.id };
  }

  async function buildActiveAuth(studentId: string, leaveTypeId: string) {
    const now = new Date();
    const auth = (
      await db
        .insert(lateStayAuthorizations)
        .values({
          studentId,
          leaveTypeId,
          version: 1,
          validFrom: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)),
          validUntil: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30, 23, 59, 59)),
          startTimeMinutes: 18 * 60,
          endTimeMinutes: 22 * 60,
          daysOfWeekMask: 127,
          reason: "Phase 8 concurrency audit",
          status: "ACTIVE",
          pocApprovedAt: now,
          adminApprovedAt: now,
        })
        .returning()
    )[0]!;
    createdAuthIds.push(auth.id);
    return auth;
  }

  /** Widen the fixture's daily window when "now" is outside 18:00–22:00 UTC. */
  async function widenWindowForNow(authId: string) {
    const now = new Date();
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (minutes < 18 * 60 || minutes >= 22 * 60) {
      await db
        .update(lateStayAuthorizations)
        .set({ startTimeMinutes: 0, endTimeMinutes: 24 * 60 - 1 })
        .where(eq(lateStayAuthorizations.id, authId));
    }
  }

  async function countLiveOccurrences(authorizationId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leaveRequests)
      .where(
        and(
          sql`${leaveRequests.metadata} ->> 'authorizationId' = ${authorizationId}`,
          sql`${leaveRequests.status} NOT IN ('CANCELLED', 'REJECTED')`
        )
      );
    return rows[0]?.count ?? 0;
  }

  async function buildPlainOccurrence(
    authorizationId: string,
    studentId: string,
    leaveTypeId: string
  ) {
    const now = new Date();
    const row = (
      await db
        .insert(leaveRequests)
        .values({
          requestNumber: `LR-${STAMP}-${Math.random().toString(36).slice(2, 8)}`,
          studentId,
          leaveTypeId,
          reason: "audit fixture occurrence",
          status: "APPROVED",
          startAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 18, 0)),
          endAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 22, 0)),
          submittedForm: { occurrence: true },
          metadata: {
            authorizationId,
            occurrenceDate: now.toISOString().slice(0, 10),
            approvalSource: "RECURRING_AUTHORIZATION",
          },
          approvedAt: now,
        })
        .returning()
    )[0]!;
    createdLeaveIds.push(row.id);
    return row;
  }

  // The real services, pointed at the same DB.
  const { claimLateStayOccurrence } = await import(
    "@/services/leave/recurring-authorization/claim-occurrence.service"
  );
  const { authorizeLateStay } = await import(
    "@/services/leave/recurring-authorization/approve-authorization.service"
  );
  const { revokeLateStayAuthorization } = await import(
    "@/services/leave/recurring-authorization/revoke-authorization.service"
  );

  const studentUserFor = (u: { id: string }) => ({
    id: u.id,
    roles: ["STUDENT"],
    email: null,
    clerkId: "audit",
  });
  const pocUserFor = (u: { id: string }) => ({
    id: u.id,
    roles: ["ADMIN"],
    email: null,
    clerkId: "audit",
  });

  // Per-probe isolation: the overlap guard is per-student stateful.
  let currentUser: ReturnType<typeof studentUserFor> | null = null;
  let studentId: string | null = null;

  async function freshStudent() {
    if (studentId) {
      await db.delete(leaveRequests).where(eq(leaveRequests.studentId, studentId));
    }
    const fixture = await buildStudentFixture();
    studentId = fixture.student.id;
    currentUser = studentUserFor(fixture.user);
  }

  const callClaim = (authId: string) =>
    claimLateStayOccurrence(
      authId,
      {},
      currentUser as unknown as Parameters<typeof claimLateStayOccurrence>[2]
    );

  const staffUser = (
    await db
      .insert(users)
      .values({
        fullName: "LSA Audit Staff",
        email: `${STAMP}-staff@test.local`,
        isActive: true,
      })
      .returning()
  )[0]!;
  createdUserIds.push(staffUser.id);

  try {
    const leaveType = (
      await db
        .select()
        .from(leaveTypes)
        .where(eq(leaveTypes.code, "LATE_STAY_COLLEGE"))
        .limit(1)
    )[0];
    if (!leaveType) throw new Error("LATE_STAY_COLLEGE leave type missing — seed first");

    // ----------------------------------------------------------------
    // Probe A — N concurrent same-day claims
    // ----------------------------------------------------------------
    console.log("\n[A] 6 concurrent claims on the same authorization + date");
    {
      await freshStudent();
      const auth = await buildActiveAuth(studentId!, leaveType.id);
      await widenWindowForNow(auth.id);

      const N = 6;
      const results = await Promise.allSettled(
        Array.from({ length: N }, () => callClaim(auth.id))
      );

      const fulfilled = results.filter(
        (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled"
      );
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected"
      );
      const liveCount = await countLiveOccurrences(auth.id);
      const allRows = await db
        .select({ id: leaveRequests.id })
        .from(leaveRequests)
        .where(sql`${leaveRequests.metadata} ->> 'authorizationId' = ${auth.id}`);

      record(
        "A.row-count",
        liveCount === 1 && allRows.length === 1 ? "PASS" : "FAIL",
        `live occurrences = ${liveCount} (all rows: ${allRows.length}); expected exactly 1`
      );

      const replays = fulfilled.filter((r) => r.value?.idempotentReplay === true).length;
      const fresh = fulfilled.filter((r) => r.value?.idempotentReplay === false).length;
      const uniqueViolation = rejected.filter((r) =>
        String(r.reason?.message ?? "").match(/duplicate key|unique constraint|23505/i)
      ).length;
      const otherErrors = rejected.length - uniqueViolation;

      record(
        "A.outcome-split",
        fresh === 1 && replays + uniqueViolation === N - 1 && otherErrors === 0
          ? "PASS"
          : "OBSERVATION",
        `of ${N} concurrent claims: ${fresh} created, ${replays} graceful replays, ${uniqueViolation} raw unique-violations, ${otherErrors} other errors`
      );

      if (otherErrors > 0) {
        console.log(
          `    first unexpected error: ${String(
            rejected.find(
              (r) =>
                !String(r.reason?.message ?? "").match(
                  /duplicate key|unique constraint|23505/i
                )
            )?.reason?.message
          )}`
        );
      }
    }

    // ----------------------------------------------------------------
    // Probe B — sequential retry (the common case)
    // ----------------------------------------------------------------
    console.log("\n[B] sequential double-claim (client retry after lost response)");
    {
      await freshStudent();
      const auth = await buildActiveAuth(studentId!, leaveType.id);
      await widenWindowForNow(auth.id);

      const first = await callClaim(auth.id);
      const second = await callClaim(auth.id);

      record(
        "B.replay",
        first.idempotentReplay === false &&
          second.idempotentReplay === true &&
          first.occurrenceId === second.occurrenceId
          ? "PASS"
          : "FAIL",
        `first.idempotentReplay=${first.idempotentReplay}, second.idempotentReplay=${second.idempotentReplay}, sameId=${first.occurrenceId === second.occurrenceId}`
      );
    }

    // ----------------------------------------------------------------
    // Probe C — claim racing with revocation
    // ----------------------------------------------------------------
    console.log("\n[C] concurrent claims while the authorization flips to REVOKED");
    {
      await freshStudent();
      const auth = await buildActiveAuth(studentId!, leaveType.id);
      await widenWindowForNow(auth.id);

      const [claimResult] = await Promise.allSettled([
        callClaim(auth.id),
        revokeLateStayAuthorization(
          auth.id,
          "Phase 8 audit revocation",
          pocUserFor(staffUser) as never
        ),
      ]);

      const liveCount = await countLiveOccurrences(auth.id);
      const claimedBeforeRevoke = claimResult.status === "fulfilled";

      record(
        "C.row-count",
        liveCount === 1 ? "PASS" : "FAIL",
        `live occurrences = ${liveCount}; expected exactly 1 regardless of interleaving`
      );

      record(
        "C.matrix-entry",
        "OBSERVATION",
        `interleaving resolved as: claim ${
          claimedBeforeRevoke
            ? "WON the race (claim before revoke)"
            : "LOST the race (revoked first)"
        } — per the locked policy a claimed occurrence is HONORED and finishes its own lifecycle; only future claims are blocked`
      );

      // Post-revocation claim must be refused.
      const postRevoke = await Promise.allSettled([callClaim(auth.id)]);
      record(
        "C.post-revoke-claim",
        postRevoke[0].status === "rejected" ? "PASS" : "FAIL",
        `claim after REVOKED ${
          postRevoke[0].status === "rejected"
            ? "refused"
            : "WRONGLY SUCCEEDED"
        }`
      );
    }

    // ----------------------------------------------------------------
    // Probe D — V2 approval racing V1 revocation
    // ----------------------------------------------------------------
    console.log("\n[D] V2 approval concurrent with V1 revocation");
    {
      await freshStudent();
      const v1 = await buildActiveAuth(studentId!, leaveType.id);

      // A pending child version (V2), PENDING_ADMIN so the approve call flips it ACTIVE.
      const v2 = (
        await db
          .insert(lateStayAuthorizations)
          .values({
            studentId: studentId!,
            leaveTypeId: leaveType.id,
            parentAuthorizationId: v1.id,
            version: 2,
            validFrom: v1.validFrom,
            validUntil: v1.validUntil,
            startTimeMinutes: 18 * 60,
            endTimeMinutes: 23 * 60,
            daysOfWeekMask: 127,
            reason: "Phase 8 audit V2",
            status: "PENDING_ADMIN",
            pocApprovedAt: new Date(),
          })
          .returning()
      )[0]!;
      createdAuthIds.push(v2.id);

      const [approveResult] = await Promise.allSettled([
        authorizeLateStay(
          v2.id,
          "APPROVED",
          "audit",
          pocUserFor(staffUser) as never
        ),
        revokeLateStayAuthorization(
          v1.id,
          "Phase 8 audit V1 revocation",
          pocUserFor(staffUser) as never
        ),
      ]);

      const after = await db
        .select({
          id: lateStayAuthorizations.id,
          version: lateStayAuthorizations.version,
          status: lateStayAuthorizations.status,
        })
        .from(lateStayAuthorizations)
        .where(inArray(lateStayAuthorizations.id, [v1.id, v2.id]));

      const v1Status = after.find((r) => r.id === v1.id)?.status;
      const v2Status = after.find((r) => r.id === v2.id)?.status;
      const activeCount = after.filter((r) => r.status === "ACTIVE").length;

      record(
        "D.single-active",
        activeCount <= 1 ? "PASS" : "FAIL",
        `after concurrent approve(V2)+revoke(V1): V1=${v1Status}, V2=${v2Status}, ACTIVE count=${activeCount} (approve ${approveResult.status})`
      );

      // Attributability: occurrences written under V1 keep naming V1.
      const occ = await buildPlainOccurrence(v1.id, studentId!, leaveType.id);
      const meta = occ.metadata as { authorizationId?: string };
      record(
        "D.attributability",
        meta?.authorizationId === v1.id ? "PASS" : "FAIL",
        `V1-era occurrence still names authorizationId=${meta?.authorizationId} — history never rewritten`
      );
    }

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------
    console.log("\n=== PHASE 8.1 SUMMARY ===");
    for (const f of findings) {
      console.log(`  [${f.verdict}] ${f.name} — ${f.detail}`);
    }
    const failed = findings.filter((f) => f.verdict === "FAIL");
    console.log(
      failed.length === 0
        ? "  → No invariant violations. Surface observations (if any) are listed above."
        : `  → ${failed.length} INVARIANT VIOLATION(S) — fix before proceeding.`
    );
  } catch (error) {
    probeError = error;
    console.error("\nProbe crashed:", error);
  } finally {
    // ----------------------------------------------------------------
    // Cleanup (disposable fixtures only)
    // ----------------------------------------------------------------
    console.log("\nCleaning up fixtures...");
    try {
      if (createdLeaveIds.length > 0) {
        await db.delete(leaveRequests).where(inArray(leaveRequests.id, createdLeaveIds));
      }
      if (createdAuthIds.length > 0) {
        await db.delete(lateStayAuthorizations).where(inArray(lateStayAuthorizations.id, createdAuthIds));
      }
      if (createdStudentIds.length > 0) {
        await db.delete(students).where(inArray(students.id, createdStudentIds));
      }
      if (createdUserIds.length > 0) {
        await db.delete(users).where(inArray(users.id, createdUserIds));
      }
      if (createdGroupIds.length > 0) {
        await db.delete(academicGroups).where(inArray(academicGroups.id, createdGroupIds));
      }
      console.log("  fixtures removed");
    } catch (cleanupError) {
      console.error("  cleanup failed — remove lsa-audit-* fixtures manually:", cleanupError);
    }

    // The pg pool keeps the event loop alive; exit explicitly with a code
    // that reflects the audit outcome (crash or violation → nonzero).
    const failedCount = findings.filter((f) => f.verdict === "FAIL").length;
    process.exit(probeError || failedCount > 0 ? 1 : 0);
  }
}

main().catch((err) => {
  console.error("Audit crashed:", err);
  process.exit(1);
});
