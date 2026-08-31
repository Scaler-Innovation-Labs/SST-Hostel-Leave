import { MetricSkeleton, RowSkeleton, Skeleton } from "@/design-system/sst";

/**
 * The shape of a console screen: masthead, a row of metric tiles, then
 * sections. A skeleton mirrors the real layout rather than spinning — the page
 * should not jump when the content lands.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 rounded-2xl" />
      <MetricSkeleton count={4} />
      <RowSkeleton rows={4} />
    </div>
  );
}
