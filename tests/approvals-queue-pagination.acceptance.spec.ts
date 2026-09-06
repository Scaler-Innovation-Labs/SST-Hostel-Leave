/**
 * Post-merge acceptance: approvals queue pagination (21 rows / 8 requests).
 *
 * This is the semantic contract behind the request-level pagination change:
 * one card per leave request, pages sliced over leave-request ids, with
 * queue-wide stepBreakdown. Mocked specs cover the shape; this covers the
 * behavior against a real database.
 *
 * Runs ONLY with RUN_DB_ACCEPTANCE=1 (it seeds and deletes rows). Everywhere
 * else the suite reports it as skipped. Delete neither the gate nor this file
 * until the scenario below has passed at least once against a live database.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";

import { academicGroups, departments, students } from "@/db/schema/academics";
import { users } from "@/db/schema/auth";
import { hostels } from "@/db/schema/hostel";
import { leaveApprovals, leaveRequests, leaveTypes } from "@/db/schema/leave";
import { movementStates } from "@/db/schema/movement";
import type { ListApprovalsQuery } from "@/dto/approval/list-approvals.dto";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { AuthorizationError } from "@/lib/errors";
import { listApprovals } from "@/services/leave/list-approvals.service";
import { ROLE_SCOPE_TYPE } from "@/constants/auth/role-scope";

const RUN = process.env.RUN_DB_ACCEPTANCE === "1";

describe.runIf(RUN)(
  "approvals queue pagination acceptance",
  () => {
    const suffix = `acc${Date.now().toString(36)}`;
    const seeded = {
      departmentIds: [] as string[],
      groupIds: [] as string[],
      hostelIds: [] as string[],
      userIds: [] as string[],
      studentIds: [] as string[],
      leaveTypeIds: [] as string[],
      requestIds: [] as string[],
    };

    let staffUser!: CurrentUser;
    let studentOneUser!: CurrentUser;

    // R1..R5 wait on PARENT (3 rows each), R6..R8 wait on POC (2 rows each).
    const plan = [
      { key: "PARENT", rows: 3 },
      { key: "PARENT", rows: 3 },
      { key: "PARENT", rows: 3 },
      { key: "PARENT", rows: 3 },
      { key: "PARENT", rows: 3 },
      { key: "POC", rows: 2 },
      { key: "POC", rows: 2 },
      { key: "POC", rows: 2 },
    ];

    beforeAll(async () => {
      const { db } = await import("@/lib/db");

      await db
        .insert(movementStates)
        .values([{ code: "IN_HOSTEL", name: "In hostel" }])
        .onConflictDoNothing();

      const [dept] = await db
        .insert(departments)
        .values({ code: `ACC-${suffix}`, name: `Acceptance ${suffix}` })
        .returning({ id: departments.id });
      seeded.departmentIds.push(dept.id);

      const [group] = await db
        .insert(academicGroups)
        .values({
          departmentId: dept.id,
          batchYear: 2026,
          name: `Acceptance ${suffix}`,
        })
        .returning({ id: academicGroups.id });
      seeded.groupIds.push(group.id);

      for (const tag of ["A", "B"] as const) {
        const [hostel] = await db
          .insert(hostels)
          .values({
            code: `ACC-${suffix}-${tag}`,
            name: `Acceptance ${suffix} ${tag}`,
          })
          .returning({ id: hostels.id });
        seeded.hostelIds.push(hostel.id);
      }
      const [studentsHostelId, otherHostelId] = seeded.hostelIds as [
        string,
        string,
      ];

      const [leaveType] = await db
        .insert(leaveTypes)
        .values({
          code: `ACC-HOME-${suffix}`,
          name: "Acceptance home pass",
          category: "HOME_PASS",
          formSchema: {},
        })
        .returning({ id: leaveTypes.id });
      seeded.leaveTypeIds.push(leaveType.id);

      const mkUser = async (tag: string, hostelId: string | null) => {
        const [row] = await db
          .insert(users)
          .values({
            fullName: `Acceptance ${tag} ${suffix}`,
            email: `acc-${suffix}-${tag}@example.com`.toLowerCase(),
            hostelId,
          })
          .returning({ id: users.id });
        seeded.userIds.push(row.id);
        return row.id;
      };

      const studentUserOneId = await mkUser("s1", studentsHostelId);
      const studentUserTwoId = await mkUser("s2", studentsHostelId);

      const mkStudent = async (userId: string, tag: string) => {
        const [row] = await db
          .insert(students)
          .values({
            userId,
            academicGroupId: group.id,
            rollNumber: `ACC-${suffix}-${tag}`,
            currentLocationState: "IN_HOSTEL",
          })
          .returning({ id: students.id });
        seeded.studentIds.push(row.id);
        return row.id;
      };
      const [studentOneId, studentTwoId] = await Promise.all([
        mkStudent(studentUserOneId, "r1"),
        mkStudent(studentUserTwoId, "r2"),
      ]);

      const now = Date.now();
      for (let index = 0; index < plan.length; index += 1) {
        const spec = plan[index];
        if (!spec) continue;
        const ownerId = index < 5 ? studentOneId : studentTwoId;
        const [request] = await db
          .insert(leaveRequests)
          .values({
            requestNumber: `ACC-${suffix}-${index + 1}`,
            studentId: ownerId,
            leaveTypeId: leaveType.id,
            reason: "acceptance scenario",
            status: "PENDING",
            currentStepKey: spec.key,
            startAt: new Date(now + 86_400_000),
            endAt: new Date(now + 2 * 86_400_000),
            submittedForm: {},
            // Distinct timestamps keep page order deterministic.
            createdAt: new Date(now + index * 1000),
          })
          .returning({ id: leaveRequests.id });
        seeded.requestIds.push(request.id);

        await db.insert(leaveApprovals).values(
          Array.from({ length: spec.rows }, (_, order) => ({
            leaveRequestId: request.id,
            stepKey: spec.key,
            stepOrder: order + 1,
            decision: "PENDING" as const,
            approvalSource: "SYSTEM" as const,
          })),
        );
      }

      studentOneUser = {
        id: studentUserOneId,
        clerkId: `acc-clerk-${suffix}-s1`,
        email: null,
        roles: [ROLES.STUDENT],
      };
      staffUser = {
        id: `acc-staff-${suffix}`,
        clerkId: `acc-clerk-${suffix}-staff`,
        email: null,
        roles: [ROLES.ADMIN],
        roleScopes: [
          {
            roleCode: ROLES.ADMIN,
            scopeType: ROLE_SCOPE_TYPE.HOSTEL,
            scopeId: otherHostelId,
          },
        ],
      };
    }, 120_000);

    afterAll(async () => {
      const { db } = await import("@/lib/db");
      if (seeded.requestIds.length > 0) {
        await db
          .delete(leaveRequests)
          .where(inArray(leaveRequests.id, seeded.requestIds));
      }
      if (seeded.studentIds.length > 0) {
        await db
          .delete(students)
          .where(inArray(students.id, seeded.studentIds));
      }
      if (seeded.userIds.length > 0) {
        await db.delete(users).where(inArray(users.id, seeded.userIds));
      }
      if (seeded.leaveTypeIds.length > 0) {
        await db
          .delete(leaveTypes)
          .where(inArray(leaveTypes.id, seeded.leaveTypeIds));
      }
      if (seeded.groupIds.length > 0) {
        await db
          .delete(academicGroups)
          .where(inArray(academicGroups.id, seeded.groupIds));
      }
      if (seeded.departmentIds.length > 0) {
        await db
          .delete(departments)
          .where(inArray(departments.id, seeded.departmentIds));
      }
      if (seeded.hostelIds.length > 0) {
        await db.delete(hostels).where(inArray(hostels.id, seeded.hostelIds));
      }
    }, 120_000);

    const superAdmin: CurrentUser = {
      id: "acc-super-admin",
      clerkId: "acc-clerk-super-admin",
      email: null,
      roles: [ROLES.SUPER_ADMIN],
    };

    const query = (
      overrides: Partial<ListApprovalsQuery> = {},
    ): ListApprovalsQuery =>
      ({ page: 1, limit: 5, ...overrides }) as ListApprovalsQuery;

    it("pages 8 requests as 5 + 3 with no duplication", async () => {
      const page1 = await listApprovals(
        query({ page: 1, limit: 5 }),
        superAdmin,
      );
      const page2 = await listApprovals(
        query({ page: 2, limit: 5 }),
        superAdmin,
      );

      expect(page1.total).toBe(8);
      expect(page1.totalPages).toBe(2);
      expect(page1.items).toHaveLength(5);
      expect(page2.items).toHaveLength(3);

      const ids1 = page1.items.map((item) => item.leaveRequest?.id ?? item.id);
      const ids2 = page2.items.map((item) => item.leaveRequest?.id ?? item.id);
      expect(new Set([...ids1, ...ids2]).size).toBe(8);
      expect(ids1.filter((id) => ids2.includes(id))).toEqual([]);
    }, 60_000);

    it("keeps stepBreakdown queue-wide and matching the waitingOn chips", async () => {
      const page1 = await listApprovals(
        query({ page: 1, limit: 5 }),
        superAdmin,
      );
      const counts = new Map(
        page1.stepBreakdown.map((entry) => [entry.stepKey, entry.count]),
      );
      expect(counts.get("PARENT")).toBe(5);
      expect(counts.get("POC")).toBe(3);

      const parent = await listApprovals(
        query({ waitingOn: "PARENT", limit: 20 }),
        superAdmin,
      );
      const poc = await listApprovals(
        query({ waitingOn: "POC", limit: 20 }),
        superAdmin,
      );
      expect(parent.total).toBe(5);
      expect(parent.items).toHaveLength(5);
      expect(poc.total).toBe(3);
      expect(poc.items).toHaveLength(3);
    }, 60_000);

    it("scopes a student to their own 4 requests", async () => {
      const result = await listApprovals(query({ limit: 20 }), studentOneUser);
      expect(result.total).toBe(4);
      expect(result.items).toHaveLength(4);
    }, 60_000);

    it("rejects cross-hostel staff with 403", async () => {
      await expect(
        listApprovals(
          query({ leaveRequestId: seeded.requestIds[0] }),
          staffUser,
        ),
      ).rejects.toBeInstanceOf(AuthorizationError);
    }, 60_000);
  },
  180_000,
);
