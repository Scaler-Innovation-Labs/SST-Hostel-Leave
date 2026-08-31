import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A skeleton mirrors the real layout: same block sizes, same rhythm. A bare
 * spinner is only acceptable where the shape genuinely is not known.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-sunken", className)}
      {...props}
    />
  );
}

export { Skeleton };
