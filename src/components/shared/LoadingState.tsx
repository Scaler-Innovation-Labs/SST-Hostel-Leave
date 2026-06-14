import { cn } from "@/lib/utils";

type LoadingStateProps = {
  className?: string;
  count?: number;
};

export function LoadingState({ className, count = 3 }: LoadingStateProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-muted"
        />
      ))}
    </div>
  );
}
