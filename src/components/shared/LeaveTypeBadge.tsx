import { toHexAlpha } from "@/lib/color-utils";
import { cn } from "@/lib/utils";

type LeaveTypeBadgeProps = {
  /** Human-readable leave type name. */
  name: string;
  /** Computed color from leave_types.uiConfig.color (any CSS color). */
  color?: string | null;
  className?: string;
};

export function LeaveTypeBadge({ name, color, className }: LeaveTypeBadgeProps) {
  const hex = color && /^#/.test(color) ? color : null;
  const bg = hex ? (toHexAlpha(hex, "1A") ?? undefined) : undefined;
  const border = hex ? (toHexAlpha(hex, "33") ?? undefined) : undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        hex ? "" : "bg-muted text-muted-foreground",
        className,
      )}
      style={hex ? { color: color ?? undefined, backgroundColor: bg, borderColor: border, borderWidth: "1px" } : undefined}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={hex ? { backgroundColor: color ?? undefined } : undefined}
      />
      {name}
    </span>
  );
}