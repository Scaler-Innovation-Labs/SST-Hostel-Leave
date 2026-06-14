"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { ApprovalTable } from "@/features/approvals/components/ApprovalTable";
import { useApprovals } from "@/features/approvals/hooks/use-approvals";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

export default function POCApprovalsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("");
  const { approvals, total, isLoading, isError, error, mutate } = useApprovals({ page, limit: 20, status: statusTab || undefined, search: search || undefined });
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Inbox"
        description="Review and process leave requests."
      />

      <div className="mb-4 flex items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusTab(tab.value);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              statusTab === tab.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <input
            type="text"
            placeholder="Search student..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-9 w-48 rounded-lg border border-border bg-background px-3 pl-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          />
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <ApprovalTable
        approvals={approvals}
        total={total}
        page={page}
        totalPages={totalPages}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onPageChange={setPage}
        onMutate={() => mutate()}
        basePath="/poc/approvals"
      />
    </div>
  );
}
