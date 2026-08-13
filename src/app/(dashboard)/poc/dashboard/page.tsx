"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { ApprovalsPage } from "@/features/approvals/components/ApprovalsPage";

export default function POCDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="POC Dashboard"
        description="Review and manage pending leave approvals."
      />

      <ApprovalsPage showHeader={false} hrefPrefix="/poc/approvals" viewerRole="POC" />
    </div>
  );
}
