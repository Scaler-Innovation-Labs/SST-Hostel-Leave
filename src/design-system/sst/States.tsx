import { AlertCircle, RefreshCw } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

/**
 * The four states every data surface ships with — loading, empty, error,
 * populated — plus the refusal surface, which is the one internal tools get
 * wrong most often.
 */

type EmptyStateProps = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Why it is empty, in the user's terms: "No leave requests yet". */
  title: string;
  /** What fills it. */
  description?: string;
  /** The control that fills it. */
  action?: React.ReactNode;
  className?: string;
};

/**
 * An icon in a tinted tile, never an illustration or stock art. Says why it is
 * empty and offers the action that fills it.
 */
function EmptyState({
  Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-sunken px-6 py-12 text-center",
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent ring-1 ring-inset ring-accent/10">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-small font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-caption text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type ErrorStateProps = {
  /** What failed, named. Not "Something went wrong". */
  title: string;
  /** The next step. */
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/** What failed plus a retry control. Never a blank screen. */
function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-danger/30 bg-danger-light px-6 py-12 text-center",
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10 text-danger ring-1 ring-inset ring-danger/20">
        <AlertCircle className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-small font-semibold text-danger">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-caption text-muted">{description}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

type RefusalProps = {
  /** What happened — "You can't cancel this leave." */
  what: string;
  /** Why — the rule, with its actual numbers. */
  why: string;
  /** What now — the action that is still open to them. */
  whatNow?: string;
  action?: React.ReactNode;
  className?: string;
};

/**
 * A refusal is a design surface, not an error path. Internal tools say no
 * constantly — limits, suspensions, closed hours, conflicts, approvals — and
 * every one of those answers three questions: what happened, why, and what to
 * do instead.
 *
 * Rendered inline, next to the control that caused it. Never in a modal that
 * must be dismissed before the user can act on the advice.
 */
function Refusal({ what, why, whatNow, action, className }: RefusalProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-light p-5",
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0">
        <h3 className="text-body font-semibold text-warning">{what}</h3>
        <p className="mt-1 text-small text-muted">
          {why}
          {whatNow ? ` ${whatNow}` : null}
        </p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/** A skeleton list that mirrors the row rhythm it stands in for. */
function RowSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3.5 rounded-xl border border-border bg-surface-sunken p-4"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A skeleton row of metric tiles, matching `MetricTile`'s box exactly. */
function MetricSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        count <= 2
          ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
          : count === 3
            ? "grid grid-cols-1 gap-4 sm:grid-cols-3"
            : "grid grid-cols-2 gap-4 lg:grid-cols-4"
      )}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-surface p-5 shadow-raised"
        >
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-7 w-14" />
        </div>
      ))}
    </div>
  );
}

/**
 * Field and scanner surfaces must state plainly that they cannot verify, and
 * must never appear to succeed while offline.
 */
function OfflineNotice({ className }: { className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-light p-5",
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
      <div>
        <h3 className="text-body-lg font-semibold text-danger">
          No connection — passes can&apos;t be verified
        </h3>
        <p className="mt-1 text-body text-muted">
          Nothing scanned right now can be checked against the server. Wait for
          the connection to come back before letting anyone through.
        </p>
      </div>
    </div>
  );
}

export {
  EmptyState,
  ErrorState,
  MetricSkeleton,
  OfflineNotice,
  Refusal,
  RowSkeleton,
};
export type { EmptyStateProps, ErrorStateProps, RefusalProps };
