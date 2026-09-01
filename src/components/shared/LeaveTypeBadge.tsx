import { cn } from "@/lib/utils";

type LeaveTypeBadgeProps = {
  /** Human-readable leave type name. */
  name: string;
  /** The colour an admin assigned in leave_types.uiConfig.color. */
  color?: string | null;
  className?: string;
};

/**
 * The leave type, marked but not shouted.
 *
 * The admin's chosen colour survives as the dot — a status dot is one of the
 * two things that legitimately carries a colour of its own — while the chip
 * itself stays neutral. Previously the colour filled the chip's text, ground
 * and border, which put a second saturated pill beside the status badge and
 * left the reader unsure which one was the state.
 */
export function LeaveTypeBadge({ name, color, className }: LeaveTypeBadgeProps) {
  const hex = color && /^#/.test(color) ? color : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface-sunken px-2 py-0.5",
        "text-caption font-medium text-ink",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          hex ? "" : "bg-border-strong"
        )}
        style={hex ? { backgroundColor: hex } : undefined}
      />
      {name}
    </span>
  );
}
