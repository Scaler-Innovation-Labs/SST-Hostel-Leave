import { AnalyticsShell } from "@/features/analytics/components/AnalyticsShell";
import { StaffAnalytics } from "@/features/dashboard/components/StaffAnalytics";

export default function AdminAnalyticsPage() {
  return (
    <AnalyticsShell
      description="Leave and movement system statistics for your hostel."
      overall={<StaffAnalytics description="Leave and movement system statistics for your hostel." hidePageHeader />}
    />
  );
}