/**
 * Route inventory for performance audit.
 *
 * Every user-facing page route and the critical API endpoints it depends on.
 * Routes with `dynamic: true` require test IDs — skipped by default unless
 * PERF_TEST_DYNAMIC=1 is set.
 */

export type Role = "public" | "student" | "admin" | "super-admin" | "poc" | "guard";

export type RouteCategory =
  | "auth"
  | "dashboard"
  | "crud"
  | "analytics"
  | "scanner"
  | "profile"
  | "settings"
  | "api";

export type RouteEntry = {
  path: string;
  role: Role;
  category: RouteCategory;
  /** Route has [id] or similar dynamic segments */
  dynamic?: boolean;
  /** Skip this route during audit */
  skip?: boolean;
  /** Reason for skipping */
  skipReason?: string;
}

/**
 * Static route inventory — all 47 page routes + key API endpoints.
 */
export const PAGE_ROUTES: RouteEntry[] = [
  // ── Public / Auth ──────────────────────────────────
  { path: "/", role: "public", category: "auth" },
  { path: "/login", role: "public", category: "auth" },
  { path: "/unauthorized", role: "public", category: "auth" },
  {
    path: "/redirect",
    role: "public",
    category: "auth",
    skip: true,
    skipReason: "Transient redirect — no meaningful metrics",
  },

  // ── Student ────────────────────────────────────────
  { path: "/student/dashboard", role: "student", category: "dashboard" },
  { path: "/student/leaves", role: "student", category: "crud" },
  { path: "/student/leaves/new", role: "student", category: "crud" },
  { path: "/student/leaves/[id]", role: "student", category: "crud", dynamic: true },
  { path: "/profile", role: "student", category: "profile" },

  // ── Admin ──────────────────────────────────────────
  { path: "/admin/dashboard", role: "admin", category: "dashboard" },
  { path: "/admin/approvals", role: "admin", category: "crud" },
  { path: "/admin/approvals/[id]", role: "admin", category: "crud", dynamic: true },
  { path: "/admin/analytics", role: "admin", category: "analytics" },
  { path: "/admin/extension-approvals", role: "admin", category: "crud" },
  { path: "/admin/movements", role: "admin", category: "crud" },
  { path: "/admin/overdue", role: "admin", category: "crud" },
  { path: "/admin/students", role: "admin", category: "crud" },
  { path: "/admin/students/[id]", role: "admin", category: "crud", dynamic: true },

  // ── POC ────────────────────────────────────────────
  { path: "/poc/dashboard", role: "poc", category: "dashboard" },
  { path: "/poc/approvals/[id]", role: "poc", category: "crud", dynamic: true },

  // ── Guard ──────────────────────────────────────────
  { path: "/guard/scanner", role: "guard", category: "scanner" },

  // ── Super Admin ────────────────────────────────────
  { path: "/super-admin/dashboard", role: "super-admin", category: "dashboard" },
  { path: "/super-admin/analytics", role: "super-admin", category: "analytics" },
  { path: "/super-admin/approvals", role: "super-admin", category: "crud" },
  { path: "/super-admin/approvals/[id]", role: "super-admin", category: "crud", dynamic: true },
  { path: "/super-admin/extension-approvals", role: "super-admin", category: "crud" },
  { path: "/super-admin/hostels", role: "super-admin", category: "crud" },
  { path: "/super-admin/departments", role: "super-admin", category: "crud" },
  { path: "/super-admin/academic-groups", role: "super-admin", category: "crud" },
  { path: "/super-admin/leave-types", role: "super-admin", category: "crud" },
  { path: "/super-admin/notification-rules", role: "super-admin", category: "settings" },
  { path: "/super-admin/notification-templates", role: "super-admin", category: "settings" },
  { path: "/super-admin/notifications/delivery-logs", role: "super-admin", category: "settings" },
  { path: "/super-admin/parents", role: "super-admin", category: "crud" },
  { path: "/super-admin/policies", role: "super-admin", category: "settings" },
  { path: "/super-admin/settings", role: "super-admin", category: "settings" },
  { path: "/super-admin/students", role: "super-admin", category: "crud" },
  { path: "/super-admin/students/[id]", role: "super-admin", category: "crud", dynamic: true },
  { path: "/super-admin/users", role: "super-admin", category: "crud" },
  { path: "/super-admin/users/new", role: "super-admin", category: "crud" },
  { path: "/super-admin/users/[id]", role: "super-admin", category: "crud", dynamic: true },
  { path: "/super-admin/users/[id]/edit", role: "super-admin", category: "crud", dynamic: true },
  { path: "/super-admin/workflows", role: "super-admin", category: "settings" },
];

/**
 * Critical API endpoints to monitor during page visits.
 * The audit measures response times for these automatically.
 */
export const MONITORED_API_PATTERNS = [
  "/api/v1/auth/",
  "/api/v1/badges",
  "/api/v1/dashboard/",
  "/api/v1/analytics/",
  "/api/v1/approvals",
  "/api/v1/leaves",
  "/api/v1/movements",
  "/api/v1/students",
  "/api/v1/users",
  "/api/v1/notifications",
  "/api/v1/overdue",
  "/api/v1/hostels",
  "/api/v1/departments",
  "/api/v1/leave-types",
  "/api/v1/policies",
  "/api/v1/workflows",
  "/api/v1/parents",
  "/api/v1/academic-groups",
  "/api/v1/notification-rules",
  "/api/v1/notification-templates",
  "/api/v1/extensions/",
  "/api/v1/audit",
];

/**
 * Get routes filtered by role, excluding skipped and (optionally) dynamic routes.
 */
export function getRoutesForAudit(
  role?: Role,
  includeDynamic = false,
): RouteEntry[] {
  return PAGE_ROUTES.filter((r) => {
    if (r.skip) return false;
    if (!includeDynamic && r.dynamic) return false;
    if (role && r.role !== role && r.role !== "public") return false;
    return true;
  });
}

/**
 * Group routes by role for organized test execution.
 */
export function groupByRole(routes: RouteEntry[]): Map<Role, RouteEntry[]> {
  const groups = new Map<Role, RouteEntry[]>();
  for (const route of routes) {
    const existing = groups.get(route.role) ?? [];
    existing.push(route);
    groups.set(route.role, existing);
  }
  return groups;
}
