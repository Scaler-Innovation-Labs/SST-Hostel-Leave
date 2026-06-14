"use client";

import { useParams, useRouter } from "next/navigation";

import { ApprovalDetailView } from "@/features/approvals/components/ApprovalDetailView";

export default function SuperAdminApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  return <ApprovalDetailView leaveId={id} onBack={() => router.push("/super-admin/approvals")} />;
}
