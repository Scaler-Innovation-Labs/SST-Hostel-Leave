/**
 * Create dedicated performance-test users (Clerk + DB) for the Playwright
 * performance audit.
 *
 * Uses EMAIL + PASSWORD accounts (supported on the stunning-mastiff Clerk
 * instance). Backend-created emails are auto-verified by Clerk, so the
 * programmatic sign-in flow in performance/auth.setup.ts works immediately.
 *
 * Idempotent: existing Clerk users get their password reset; DB users are
 * matched by email and their clerkId refreshed to the current instance.
 * Legacy username-only perf rows (from the previous Clerk instance) are
 * removed first so email-keyed state is authoritative.
 *
 * Usage:
 *   npx tsx scripts/create-perf-test-users.ts
 */

import * as dotenv from "dotenv";
import { eq, inArray, like, or } from "drizzle-orm";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const CLERK_API = "https://api.clerk.com/v1";

type PerfUser = {
  /** Env suffix used by performance/auth.setup.ts */
  key: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const PERF_USERS: PerfUser[] = [
  {
    key: "SUPER_ADMIN",
    email: "perf-super-admin@sst-perf.dev",
    password: "PerfTest!SuperAdmin26",
    firstName: "Perf",
    lastName: "SuperAdmin",
  },
  {
    key: "ADMIN",
    email: "perf-admin@sst-perf.dev",
    password: "PerfTest!Admin26",
    firstName: "Perf",
    lastName: "Admin",
  },
  {
    key: "STUDENT",
    email: "perf-student@sst-perf.dev",
    password: "PerfTest!Student26",
    firstName: "Perf",
    lastName: "Student",
  },
];

// ── Clerk ──────────────────────────────────────────────────────

async function clerk(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY missing from environment");
  }

  const res = await fetch(`${CLERK_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok && !(res.status === 404 && method === "DELETE")) {
    throw new Error(
      `Clerk ${method} ${path} failed (${res.status}): ${JSON.stringify(json)}`
    );
  }
  return (json ?? {}) as Record<string, unknown>;
}

async function findClerkUserIdByEmail(email: string): Promise<string | null> {
  const users = await clerk(
    `/users?email_address=${encodeURIComponent(email)}`,
    "GET"
  );
  if (Array.isArray(users) && users.length > 0) {
    return (users[0] as { id: string }).id;
  }
  return null;
}

async function ensureClerkUser(user: PerfUser): Promise<string> {
  const existingId = await findClerkUserIdByEmail(user.email);

  if (existingId) {
    // Reset password so reruns always know the working credential.
    await clerk(`/users/${existingId}`, "PATCH", {
      password: user.password,
      first_name: user.firstName,
      last_name: user.lastName,
    });
    console.log(`↻ Clerk user updated (password reset): ${user.email}`);
    return existingId;
  }

  const created = await clerk("/users", "POST", {
    email_address: [user.email],
    password: user.password,
    first_name: user.firstName,
    last_name: user.lastName,
    skip_password_checks: true,
  });
  console.log(`✓ Clerk user created: ${user.email}`);
  return created.id as string;
}

// ── Database ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Creating Clerk users...");
  const clerkIds = new Map<string, string>();
  for (const user of PERF_USERS) {
    const id = await ensureClerkUser(user);
    clerkIds.set(user.key, id);
  }

  console.log("\nSyncing database rows...");
  const { ROLES } = await import("@/lib/auth/roles");
  const { ROLE_SCOPE_TYPE } = await import("@/constants/auth/role-scope");
  const { db } = await import("@/lib/db");
  const {
    academicGroups,
    hostels,
    movementStates,
    roles,
    students,
    userRoles,
    users,
  } = await import("@/db");

  // Remove legacy username-only perf users from the previous instance so
  // email-keyed rows are authoritative (cascades to students/user_roles).
  const legacy = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        like(users.fullName, "Perf %"),
        inArray(users.email, PERF_USERS.map((u) => u.email))
      )
    );

  if (legacy.length > 0) {
    await db.delete(users).where(
      inArray(
        users.id,
        legacy.map((u) => u.id)
      )
    );
    console.log(`↻ removed ${legacy.length} legacy perf user row(s)`);
  }

  const roleRows = await db.select({ id: roles.id, code: roles.code }).from(roles);
  const roleMap = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));

  const hostelRows = await db
    .select({ id: hostels.id })
    .from(hostels)
    .where(eq(hostels.code, "UNI-1"));
  const hostelId = hostelRows[0]?.id;

  const [inHostel] = await db
    .select({ code: movementStates.code })
    .from(movementStates)
    .where(eq(movementStates.code, "IN_HOSTEL"));
  const locationState = inHostel?.code ?? "IN_HOSTEL";

  const [anyGroup] = await db
    .select({ id: academicGroups.id })
    .from(academicGroups)
    .limit(1);
  if (!anyGroup) {
    throw new Error("No academic_groups rows exist — run clear-and-seed first.");
  }

  for (const user of PERF_USERS) {
    const clerkId = clerkIds.get(user.key)!;

    const inserted = await db
      .insert(users)
      .values({
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: null,
        clerkId,
        hostelId,
        isActive: true,
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });

    let userId = inserted[0]?.id;
    if (!userId) {
      const [row] = await db
        .update(users)
        .set({ clerkId })
        .where(eq(users.email, user.email))
        .returning({ id: users.id });
      userId = row!.id;
    }

    const assignments: Array<{
      roleCode: string;
      scopeType?: string;
      scopeId?: string | null;
    }> =
      user.key === "SUPER_ADMIN"
        ? [{ roleCode: ROLES.SUPER_ADMIN }]
        : user.key === "ADMIN"
          ? [
              {
                roleCode: ROLES.ADMIN,
                scopeType: ROLE_SCOPE_TYPE.HOSTEL,
                scopeId: hostelId ?? null,
              },
              { roleCode: ROLES.POC },
              { roleCode: ROLES.GUARD },
            ]
          : [{ roleCode: ROLES.STUDENT }];

    for (const { roleCode, scopeType, scopeId } of assignments) {
      const roleId = roleMap[roleCode];
      if (!roleId) continue;

      const values: Record<string, unknown> = { userId, roleId };
      if (scopeType && scopeId) {
        values.scopeType = scopeType;
        values.scopeId = scopeId;
      }

      await db.insert(userRoles).values(values).onConflictDoNothing();
    }

    if (user.key === "STUDENT") {
      await db
        .insert(students)
        .values({
          userId,
          academicGroupId: anyGroup.id,
          rollNumber: "PERF-STU-001",
          roomNumber: "P-101",
          currentLocationState: locationState,
        })
        .onConflictDoNothing({ target: students.userId });
    }

    console.log(
      `✓ DB user ready: ${user.email} [${assignments.map((a) => a.roleCode).join(", ")}]`
    );
  }

  console.log("\n═══ Set these before running the audit ═══\n");
  for (const user of PERF_USERS) {
    const envKey = user.key.replace(/-/g, "_");
    console.log(
      `$env:PERF_TEST_EMAIL_${envKey} = "${user.email}"\n$env:PERF_TEST_PASSWORD_${envKey} = "${user.password}"\n`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
