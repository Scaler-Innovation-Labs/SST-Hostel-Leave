import { cn } from "@/lib/utils";

import { Badge, type BadgeProps } from "./Badge";
import type { StatusPresentation } from "./status";

type StatusBadgeProps = Omit<BadgeProps, "tone" | "children"> & {
  /** An entry from one of the closed taxonomies in `./status`. */
  status: StatusPresentation;
};

/**
 * A status cannot be rendered without an icon and a label — colour is never
 * the sole signal, and this is where that rule is enforced by the type system
 * rather than by review. Greyscale the screen: the meaning must survive.
 */
function StatusBadge({ status, size, className, ...props }: StatusBadgeProps) {
  const { tone, label, Icon } = status;

  return (
    <Badge tone={tone} size={size} className={cn(className)} {...props}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </Badge>
  );
}

export { StatusBadge };
export type { StatusBadgeProps };
