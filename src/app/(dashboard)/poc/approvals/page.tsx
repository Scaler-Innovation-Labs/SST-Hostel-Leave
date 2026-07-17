"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => r.data ?? r);

import { PageHeader } from "@/components/shared/PageHeader";
import { ApprovalDetailWorkspace } from "@/features/approvals/components/ApprovalDetailWorkspace";
import { ApprovalFilters, type FilterState } from "@/features/approvals/components/ApprovalFilters";
import { ApprovalMetricCards } from "@/features/approvals/components/ApprovalMetricCards";
import { ApprovalQueue } from "@/features/approvals/components/ApprovalQueue";
import { computeDateRange } from "@/lib/date-utils";
import { useApprovals } from "@/features/approvals/hooks/use-approvals";
import { useLeaveTypes } from "@/features/leaves/hooks/use-leaves";
import { useWorkflows } from "@/features/workflows/hooks/use-workflows";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { cn } from "@/lib/utils";

export default function POCApprovalsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    status: LEAVE_APPROVAL_DECISION.PENDING,
    search: "",
    leaveTypeId: "",
    hostelId: "",
    workflowId: "",
    parentPending: "",
    overdue: "",
    dateRange: "today",
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch filter data
  const { leaveTypes } = useLeaveTypes();
  const { data: hostels } = useSWR<Array<{ id: string; name: string; code: string }>>("/api/v1/hostels", fetcher);
  const { data: workflowsData } = useWorkflows({ limit: 100 });

  // Derive API-ready date range from the friendly range label
  const dateRange = computeDateRange(filters.dateRange);

  const { approvals, total, totalPages, isLoading, mutate } =
    useApprovals({
      page,
      limit: 20,
      status: filters.status || undefined,
      search: filters.search || undefined,
      hostelId: filters.hostelId || undefined,
      leaveTypeId: filters.leaveTypeId || undefined,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
    });

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Review and process leave requests."
      />

      {/* Metrics */}
      <ApprovalMetricCards
        pendingCount={approvals.filter((a: any) => a.decision === LEAVE_APPROVAL_DECISION.PENDING).length}
        approvedToday={approvals.filter((a: any) => a.decision === LEAVE_APPROVAL_DECISION.APPROVED).length}
        rejectedToday={approvals.filter((a: any) => a.decision === LEAVE_APPROVAL_DECISION.REJECTED).length}
        averageSlaHours={null}
        overdueCount={0}
        parentPendingCount={0}
      />

      {/* Filters */}
      <ApprovalFilters
        filters={filters}
        onFiltersChange={(f) => {
          setFilters(f);
          setPage(1);
          setSelectedId(null);
        }}
        leaveTypes={leaveTypes}
        hostels={hostels ?? []}
        workflows={workflowsData?.items ?? []}
      />

      {/* Split-panel layout */}
      <div className="relative grid grid-cols-1 gap-6 xl:grid-cols-[480px_1fr]">
        {/* Queue (left panel) */}
        <div className={cn(mobileOpen && "hidden xl:block")}>
          <ApprovalQueue
            items={approvals.map((a: any) => ({
              id: a.id,
              studentName: a.studentName,
              studentRollNumber: a.studentRollNumber,
              decision: a.decision,
              approverRoleCode: a.approverRoleCode,
              createdAt: a.createdAt,
              stepKey: a.stepKey,
              stepOrder: a.stepOrder,
              parentApprovalVerifiedAt: a.parentApprovalVerifiedAt,
              approverParentId: a.approverParentId,
              parentName: a.parentName,
              parentPhone: a.parentPhone,
              leaveRequest: a.leaveRequest,
            }))}
            selectedId={selectedId}
            onSelect={handleSelect}
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>

        {/* Detail workspace (right panel) */}
        <div className={cn(!mobileOpen && "hidden xl:block")}>
          {selectedId ? (
            <ApprovalDetailWorkspace
              leaveId={selectedId}
              onBack={() => {
                setSelectedId(null);
                setMobileOpen(false);
              }}
              onActionComplete={() => {
                mutate();
                setSelectedId(null);
                setMobileOpen(false);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
              <h3 className="text-base font-medium">Select a request</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Click on a request from the queue to review it here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
