"use client";

import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Ban,
  Calendar,
  CheckCircle2,
  Hash,
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
    "bg-accent-light text-accent border-accent dark:border-accent",
  ADMIN:
    "bg-accent-light text-accent border-accent dark:border-accent",
  POC: "bg-warning-light text-warning border-warning dark:border-warning",
  STUDENT:
    "bg-success-light text-success border-success dark:border-success",
  GUARD:
    "bg-surface-sunken text-muted dark:bg-surface-sunken border-border-strong dark:border-border-strong",
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
        className="group inline-flex items-center gap-1.5 text-body text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Users
      </button>

      {/* Profile header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-5">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-h3 font-semibold text-white shadow-sm ${getAvatarColor(user.fullName)}`}
          >
            {getInitials(user.fullName)}
          </div>
          <div>
            <h1 className="text-h2 font-semibold tracking-tight">
              {user.fullName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </span>
              {user.phone && (
                <>
                  <span className="text-muted/50">·</span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {user.phone}
                  </span>
                </>
              )}
              {user.slackId && (
                <>
                  <span className="text-muted/50">·</span>
                  <span className="flex items-center gap-1 font-mono text-caption">
                    <Hash className="h-3.5 w-3.5" />
                    {user.slackId}
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
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md">
            <h3 className="mb-5 flex items-center gap-2 text-body-lg font-semibold">
              <UserCog className="h-4 w-4 text-muted" />
              Account Information
            </h3>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-caption font-medium text-muted uppercase tracking-wider">
                  Full Name
                </dt>
                <dd className="text-body font-medium">{user.fullName}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-caption font-medium text-muted uppercase tracking-wider">
                  Email
                </dt>
                <dd className="flex items-center gap-1.5 text-body">
                  <Mail className="h-3.5 w-3.5 text-muted" />
                  {user.email ?? "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-caption font-medium text-muted uppercase tracking-wider">
                  Phone
                </dt>
                <dd className="flex items-center gap-1.5 text-body">
                  <Phone className="h-3.5 w-3.5 text-muted" />
                  {user.phone ?? "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-caption font-medium text-muted uppercase tracking-wider">
                  Slack ID
                </dt>
                <dd className="flex items-center gap-1.5 font-mono text-body">
                  <Hash className="h-3.5 w-3.5 text-muted" />
                  {user.slackId ?? "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-caption font-medium text-muted uppercase tracking-wider">
                  Status
                </dt>
                <dd>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-medium ${
                      user.isActive
                        ? "bg-success-light text-success"
                        : "bg-danger-light text-danger"
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
                  <dt className="text-caption font-medium text-muted uppercase tracking-wider">
                    Gender
                  </dt>
                  <dd className="text-body capitalize">{user.gender}</dd>
                </div>
              )}
              <div className="space-y-1">
                <dt className="text-caption font-medium text-muted uppercase tracking-wider">
                  Created
                </dt>
                <dd className="flex items-center gap-1.5 text-body">
                  <Calendar className="h-3.5 w-3.5 text-muted" />
                  {createdAtDate}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Roles sidebar */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md">
            <h3 className="mb-5 flex items-center gap-2 text-body-lg font-semibold">
              <Shield className="h-4 w-4 text-muted" />
              Roles
            </h3>
            <div className="space-y-3">
              {user.userRoles.length === 0 ? (
                <p className="text-body text-muted">
                  No roles assigned
                </p>
              ) : (
                user.userRoles.map((r, index) => (
                  <div
                    key={`${r.roleId}-${r.scopeType ?? "ALL"}-${r.scopeId ?? "ALL"}-${index}`}
                    className={`rounded-xl border px-4 py-3 ${ROLE_STYLES[r.roleCode] ?? "bg-surface-sunken text-muted border-border"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-body font-medium">
                          {ROLE_LABELS[r.roleCode] ?? r.roleName}
                          {r.scopeType === "HOSTEL" && r.scopeName && (
                            <span className="ml-1.5 text-micro font-normal opacity-60">
                              · {r.scopeName}
                            </span>
                          )}
                          {r.scopeType === "HOSTEL" && !r.scopeName && (
                            <span className="ml-1.5 text-micro font-normal opacity-60">
                              · Hostel-scoped
                            </span>
                          )}
                        </p>
                        {r.assignedAt && (
                          <p className="text-micro opacity-70">
                            Since {new Date(r.assignedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={showDeactivateDialog}
        onOpenChange={setShowDeactivateDialog}
        title={`Deactivate ${user.fullName}?`}
        consequence="They lose access immediately and any approvals waiting on them stay unactioned until someone else picks them up. You can reactivate them later."
        confirmLabel="Deactivate account"
        dismissLabel="Keep active"
        loading={isToggling}
        onConfirm={async () => {
          await handleToggleActive();
          setShowDeactivateDialog(false);
        }}
      />
    </div>
  );
}
