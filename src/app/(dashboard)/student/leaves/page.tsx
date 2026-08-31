"use client";

import { CalendarPlus, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataToolbar } from "@/components/shared/DataToolbar";
import { Pagination } from "@/components/shared/Pagination";
import type { LeaveRequestStatus } from "@/constants/leave/leave-status";
import { ROUTES } from "@/constants/routes";
import {
  Button,
  EmptyState,
  ErrorState,
  LEAVE_STATUS_PRESENTATION,
  Masthead,
  RowSkeleton,
  StatusBadge,
} from "@/design-system/sst";
import { LeaveTypeIcon } from "@/features/leaves/components/LeaveTypeIcon";
import { useLeaves } from "@/features/leaves/hooks/use-leaves";
import { formatDateRange, getDurationLabel } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

const STATUS_OPTIONS = Object.entries(LEAVE_STATUS_PRESENTATION).map(
  ([value, { label }]) => ({ value, label })
);

type LeaveItem = {
  id: string;
  leaveTypeName: string;
  status: string;
  startAt: string;
  endAt: string;
  createdAt: string;
};

function statusPresentation(status: string) {
  return (
    LEAVE_STATUS_PRESENTATION[status as LeaveRequestStatus] ??
    LEAVE_STATUS_PRESENTATION.PENDING
  );
}

export default function StudentLeavesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const { leaves, total, isLoading, isError, mutate } = useLeaves({
    page,
    limit: PAGE_SIZE,
    status: status || undefined,
    search: search || undefined,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const items = leaves as LeaveItem[];
  const isFiltered = Boolean(search || status);

  const requestLeave = (
    <Button asChild variant="onDark" size="sm">
      <a href={ROUTES.STUDENT_LEAVE_NEW}>
        <CalendarPlus className="h-4 w-4" aria-hidden />
        Request leave
      </a>
    </Button>
  );

  return (
    <div className="space-y-6">
      <Masthead
        eyebrow="Student"
        title="My leaves"
        description="Every request you've made, and where each one got to."
        actions={requestLeave}
      />

      <DataToolbar
        searchPlaceholder="Search by leave type…"
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={[
          {
            key: "status",
            label: "Any status",
            options: STATUS_OPTIONS,
            value: status,
            onChange: (value) => {
              setStatus(value);
              setPage(1);
            },
          },
        ]}
        total={isLoading ? undefined : total}
        noun="leave request"
      />

      {isError ? (
        <ErrorState
          title="We couldn't load your leaves"
          description="The request didn't come back from the server. Nothing you've submitted is affected."
          onRetry={() => mutate()}
        />
      ) : isLoading ? (
        <RowSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState
          Icon={FileText}
          title={
            isFiltered
              ? "No leaves match those filters"
              : "No leave requests yet"
          }
          description={
            isFiltered
              ? "Try a different status, or clear the search to see everything."
              : "When you request leave, it'll appear here with its approval chain and gate pass."
          }
          action={
            isFiltered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button
                size="sm"
                trailingArrow
                onClick={() => router.push(ROUTES.STUDENT_LEAVE_NEW)}
              >
                Request leave
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {items.map((item) => {
              const presentation = statusPresentation(item.status);

              return (
                <li key={item.id}>
                  <a
                    href={`${ROUTES.STUDENT_LEAVES}/${item.id}`}
                    className={cn(
                      "group flex w-full items-center gap-3.5 px-5 py-4 text-left",
                      "transition-colors duration-fast ease-standard hover:bg-surface-hover",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent ring-1 ring-inset ring-accent/10">
                      <LeaveTypeIcon name={item.leaveTypeName} className="h-4 w-4" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-small font-semibold text-ink">
                        {item.leaveTypeName}
                      </span>
                      <span className="mt-0.5 block truncate text-caption text-muted">
                        {formatDateRange(item.startAt, item.endAt)} ·{" "}
                        {getDurationLabel(item.startAt, item.endAt)}
                      </span>
                    </span>

                    <StatusBadge
                      status={presentation}
                      className="shrink-0 max-sm:hidden"
                    />
                  </a>
                </li>
              );
            })}
          </ul>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
