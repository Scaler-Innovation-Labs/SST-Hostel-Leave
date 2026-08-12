import { StaffDashboard } from "@/features/dashboard/components/StaffDashboard";

export default function AdminDashboardPage() {
  return (
    <StaffDashboard
      basePath="/admin"
      title="Admin Dashboard"
      description="Manage leave approvals and movement workflows."
    />
  );
}
