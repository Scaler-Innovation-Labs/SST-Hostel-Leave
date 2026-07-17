"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Mail, Plus, Search, Shield, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUsers } from "@/hooks/use-users";
import { ROLES } from "@/lib/auth/roles";
import { getAvatarColor, getInitials } from "@/lib/user-utils";

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  POC: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  STUDENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  GUARD: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  POC: "POC",
  STUDENT: "Student",
  GUARD: "Guard",
};

type UserItem = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  userRoles: Array<{
    roleId: string;
    roleCode: string;
    roleName: string;
    assignedAt: string;
  }>;
};

export default function SuperAdminUsersPage() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState("");
  const [search, setSearch] = useState("");

  const { data: usersData, isLoading, isError, error, mutate } = useUsers({
    page,
    limit: 20,
    role: role || undefined,
    excludeRole: role ? undefined : "STUDENT",
    isActive: isActive || undefined,
    search: search || undefined,
  });

  const users = usersData?.items ?? [];
  const total = usersData?.total ?? 0;

  const totalPages = Math.ceil(total / 20);

  const roleFilters = useMemo(
    () => [
      { value: "", label: "All Roles" },
      { value: ROLES.STUDENT, label: "Student" },
      { value: ROLES.POC, label: "POC" },
      { value: ROLES.ADMIN, label: "Admin" },
      { value: ROLES.SUPER_ADMIN, label: "Super Admin" },
      { value: ROLES.GUARD, label: "Guard" },
    ],
    [],
  );

  const activeFilters = useMemo(
    () => [
      { value: "", label: "All Status" },
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
    [],
  );

  if (isError) {
    return <ErrorState message={error?.message ?? "Failed to load users"} onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        description="Manage all system users and their roles."
        action={
          <Link href="/super-admin/users/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create User
            </Button>
          </Link>
        }
      />

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <select
            aria-label="Filter by role"
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          >
            {roleFilters.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={isActive}
            onChange={(e) => { setIsActive(e.target.value); setPage(1); }}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          >
            {activeFilters.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary bar */}
      {!isLoading && users.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{total}</span>
          <span>user{total !== 1 ? "s" : ""} found</span>
        </div>
      )}

      {/* Users list */}
      {isLoading ? (
        <LoadingState count={5} />
      ) : users.length === 0 ? (
        <EmptyState
          title="No users found"
          description={search || role || isActive ? "No users match your filters. Try adjusting your search criteria." : "No users have been created yet."}
          action={
            search || role || isActive ? undefined : (
              <Link href="/super-admin/users/new">
                <Button>Create First User</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="divide-y divide-border">
            {users.map((user: UserItem) => (
              <Link
                key={user.id}
                href={`/super-admin/users/${user.id}`}
                className="group flex items-center gap-4 px-6 py-4 transition-all hover:bg-muted/50"
              >
                {/* Avatar */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${getAvatarColor(user.fullName)}`}
                >
                  {getInitials(user.fullName)}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{user.fullName}</span>
                    {!user.isActive && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </span>
                    {user.lastLoginAt && (
                      <span>
                        · {formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Roles */}
                <div className="hidden gap-1.5 md:flex">
                  {user.userRoles.map((r) => (
                    <span
                      key={r.roleCode}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLES[r.roleCode] ?? "bg-muted text-muted-foreground"}`}
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      {ROLE_LABELS[r.roleCode] ?? r.roleName}
                    </span>
                  ))}
                  {user.userRoles.length === 0 && (
                    <span className="text-xs text-muted-foreground">No roles</span>
                  )}
                </div>

                {/* Active indicator */}
                <div className="hidden sm:block">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      user.isActive ? "bg-emerald-500" : "bg-red-400"
                    }`}
                  />
                </div>

                {/* Chevron */}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100" />
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
