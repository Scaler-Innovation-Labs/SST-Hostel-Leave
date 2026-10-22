"use client";

import { ROUTES } from "@/constants/routes";
import { ExtensionApprovalDetailView } from "@/features/extensions/components/ExtensionApprovalDetailView";

export default function SuperAdminExtensionApprovalDetailPage() {
  return <ExtensionApprovalDetailView backRoute={ROUTES.SUPER_ADMIN_EXTENSION_APPROVALS} />;
}
