"use client";

import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { ExtensionApprovalTable } from "@/features/extensions/components/ExtensionApprovalTable";
import { useExtensionApprovals } from "@/features/extensions/hooks/use-approve-extension";

export default function SuperAdminExtensionApprovalsPage() {
  const [page, setPage] = useState(1);
  const {
    data,
    isLoading,
    isError,
    error,
    mutate,
  } = useExtensionApprovals({ page, limit: 20 });

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Extension Approvals"
        description="Review and process leave extension requests."
      />

      <ExtensionApprovalTable
        approvals={data?.items ?? []}
        total={data?.total ?? 0}
        page={page}
        totalPages={totalPages}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onPageChange={setPage}
        onMutate={() => mutate()}
      />
    </div>
  );
}
