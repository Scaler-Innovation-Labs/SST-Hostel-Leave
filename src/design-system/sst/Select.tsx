import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A native select styled as a well, matching `Input`.
 *
 * Native rather than a listbox: it is keyboard- and screen-reader-correct for
 * free, and on a phone it opens the platform picker, which is what a student
 * choosing a leave type between classes actually wants.
 */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      data-slot="select"
      className={cn(
        "h-10 w-full rounded-md border border-border bg-surface-sunken px-3 text-body text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "aria-[invalid=true]:border-danger",
        "transition-colors duration-fast ease-standard",
        "disabled:pointer-events-none disabled:opacity-45",
        className
      )}
      {...props}
    />
  );
});

export { Select };
