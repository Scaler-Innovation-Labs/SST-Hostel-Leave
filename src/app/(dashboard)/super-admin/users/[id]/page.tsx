"use client";

import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Ban,
  Calendar,
  CheckCircle2,
  Mail,
  Phone,
  Shield,
  UserCog,
  XCircle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-users";
import { getAvatarColor, getInitials } from "@/lib/user-utils";

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  ADMIN:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  POC: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  STUDENT:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  GUARD:
    "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  POC: "POC",
  STUDENT: "Student",
  GUARD: "Guard",
};

export default function SuperAdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user, isLoading, isError, error, mutate } = useUser(id);
  const [isToggling, setIsToggling] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      if (user?.isActive) {
        await fetch(`/api/v1/users/${id}`, { method: "DELETE" });
      } else {
        await fetch(`/api/v1/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
      }
      await mutate();
    } catch {
      // Error handled silently
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) return <LoadingState count={4} />;
  if (isError)
    return (
      <ErrorState
        message={error?.message ?? "User not found"}
        onRetry={() => mutate()}
      />
    );
  if (!user) return <ErrorState message="User not found" />;

  const createdAtDate = user.createdAt
    ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })
    : "—";

  return (
    <div className="space-y-8">
      {/* Back navigation */}
      <button
        onClick={() => router.push("/super-admin/users")}
        className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Users
      </button>

      {/* Profile header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-5">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm ${getAvatarColor(user.fullName)}`}
          >
            {getInitials(user.fullName)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {user.fullName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </span>
              {user.phone && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {user.phone}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/super-admin/users/${id}/edit`)}
            className="gap-2"
          >
            <UserCog className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant={user.isActive ? "destructive" : "default"}
            onClick={() =>
              user.isActive
                ? setShowDeactivateDialog(true)
                : handleToggleActive()
            }
            disabled={isToggling}
            className="gap-2"
          >
            {user.isActive ? (
              <>
                <Ban className="h-4 w-4" />
                Deactivate
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Activate
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Account info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
            <h3 className="mb-5 flex items-center gap-2 text-base font-semibold">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              Account Information
            </h3>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Full Name
                </dt>
                <dd className="text-sm font-medium">{user.fullName}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email
                </dt>
                <dd className="flex items-center gap-1.5 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {user.email ?? "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Phone
                </dt>
                <dd className="flex items-center gap-1.5 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {user.phone ?? "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </dt>
                <dd>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      user.isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {user.isActive ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </dd>
              </div>
              {user.gender && (
                <div className="space-y-1">
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Gender
                  </dt>
                  <dd className="text-sm capitalize">{user.gender}</dd>
                </div>
              )}
              <div className="space-y-1">
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Created
                </dt>
                <dd className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {createdAtDate}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Roles sidebar */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
            <h3 className="mb-5 flex items-center gap-2 text-base font-semibold">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Roles
            </h3>
            <div className="space-y-3">
              {user.userRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No roles assigned
                </p>
              ) : (
                user.userRoles.map((r) => (
                  <div
                    key={r.roleCode}
                    className={`rounded-xl border px-4 py-3 ${ROLE_STYLES[r.roleCode] ?? "bg-muted text-muted-foreground border-border"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          {ROLE_LABELS[r.roleCode] ?? r.roleName}
                        </p>
                        {r.assignedAt && (
                          <p className="text-[10px] opacity-70">
                            Since{" "}
                            {new Date(r.assignedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {user.lastLoginAt && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Activity
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Login</span>
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(user.lastLoginAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={showDeactivateDialog}
        onOpenChange={setShowDeactivateDialog}
        title="Deactivate User"
        description={`Are you sure you want to deactivate ${user.fullName}? They will lose access to the system.`}
        confirmLabel="Deactivate"
        variant="destructive"
        loading={isToggling}
        onConfirm={async () => {
          await handleToggleActive();
          setShowDeactivateDialog(false);
        }}
      />
    </div>
  );
}
