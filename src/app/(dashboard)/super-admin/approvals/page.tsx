"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApprovalTable } from "@/features/approvals/components/ApprovalTable";
import { useApprovals } from "@/features/approvals/hooks/use-approvals";
import { ExtensionApprovalTable } from "@/features/extensions/components/ExtensionApprovalTable";
import { useExtensionApprovals } from "@/features/extensions/hooks/use-approve-extension";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

export default function SuperAdminApprovalsPage() {
  const [leavePage, setLeavePage] = useState(1);
  const [statusTab, setStatusTab] = useState("");
  const [search, setSearch] = useState("");

  const { approvals, total, isLoading, isError, error, mutate } = useApprovals({
    page: leavePage,
    limit: 20,
    status: statusTab || undefined,
    search: search || undefined,
  });
  const totalPages = Math.ceil(total / 20);

  const [extPage, setExtPage] = useState(1);
  const [extSearch, setExtSearch] = useState("");
  const {
    data: extData,
    isLoading: extLoading,
    isError: extError,
    error: extErr,
    mutate: extMutate,
  } = useExtensionApprovals({ page: extPage, limit: 20, search: extSearch || undefined });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Review and process leave and extension requests."
      />

      <Tabs defaultValue="leaves">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="leaves">Leave Approvals</TabsTrigger>
            <TabsTrigger value="extensions">Extension Approvals</TabsTrigger>
          </TabsList>

          {/* Quick count badges */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Pending
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600">
              Approved
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-600">
              Rejected
            </span>
          </div>
        </div>

        <TabsContent value="leaves" className="pt-4">
          {/* Status filter tabs */}
          <div className="mb-4 flex items-center gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStatusTab(tab.value);
                  setLeavePage(1);
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

            {/* Search */}
            <div className="relative ml-auto">
              <input
                type="text"
                placeholder="Search student..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLeavePage(1);
                }}
                className="h-9 w-48 rounded-lg border border-border bg-background px-3 pl-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <ApprovalTable
            approvals={approvals}
            total={total}
            page={leavePage}
            totalPages={totalPages}
            isLoading={isLoading}
            isError={isError}
            error={error}
            onPageChange={setLeavePage}
            onMutate={() => mutate()}
            basePath="/super-admin/approvals"
          />
        </TabsContent>

        <TabsContent value="extensions" className="pt-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="relative ml-auto">
              <input
                type="text"
                placeholder="Search student..."
                value={extSearch}
                onChange={(e) => {
                  setExtSearch(e.target.value);
                  setExtPage(1);
                }}
                className="h-9 w-48 rounded-lg border border-border bg-background px-3 pl-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <ExtensionApprovalTable
            approvals={extData?.items ?? []}
            total={extData?.total ?? 0}
            page={extPage}
            totalPages={Math.ceil((extData?.total ?? 0) / 20)}
            isLoading={extLoading}
            isError={extError}
            error={extErr}
            onPageChange={setExtPage}
            onMutate={() => extMutate()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
