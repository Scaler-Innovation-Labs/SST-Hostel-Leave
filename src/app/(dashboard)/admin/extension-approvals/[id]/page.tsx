"use client";

import { ROUTES } from "@/constants/routes";
import { ExtensionApprovalDetailView } from "@/features/extensions/components/ExtensionApprovalDetailView";

export default function AdminExtensionApprovalDetailPage() {
  return <ExtensionApprovalDetailView backRoute={ROUTES.ADMIN_EXTENSION_APPROVALS} />;
}
