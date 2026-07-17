import { cn } from "@/lib/utils";

type LoadingStateProps = {
  className?: string;
  count?: number;
};

export function LoadingState({ className, count = 3 }: LoadingStateProps) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-linear-to-r from-muted via-muted/80 to-muted"
        />
      ))}
    </div>
  );
}
