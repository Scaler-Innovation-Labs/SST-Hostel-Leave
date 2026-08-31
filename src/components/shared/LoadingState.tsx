import { Skeleton } from "@/design-system/sst";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  className?: string;
  count?: number;
};

/**
 * A skeleton mirrors the real layout: same block sizes, same rhythm. These
 * stand in for a list of rows — a surface with a different shape should use
 * `RowSkeleton` or `MetricSkeleton` from the design system instead.
 */
export function LoadingState({ className, count = 3 }: LoadingStateProps) {
  return (
    <div className={cn("grid gap-4", className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}
