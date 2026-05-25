import { cn } from "@/lib/utils";

type Status =
  | "approved"
  | "pending"
  | "rejected"
  | "active";

type StatusBadgeProps = {
  status: Status;
};

const styles: Record<Status, string> = {
  approved:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",

  pending:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400",

  rejected:
    "bg-red-500/10 text-red-600 dark:text-red-400",

  active:
    "bg-primary/10 text-primary",
};

export function StatusBadge({
  status,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        `
          inline-flex items-center
          rounded-full px-3 py-1
          text-xs font-medium capitalize
        `,
        styles[status]
      )}
    >
      {status}
    </span>
  );
}