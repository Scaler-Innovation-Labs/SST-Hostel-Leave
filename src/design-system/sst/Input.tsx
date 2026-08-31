import * as React from "react";

import { cn } from "@/lib/utils";

import { DISABLED } from "./interaction";

/**
 * A well inside a surface: sunken ground, hairline edge, accent ring on focus.
 * The label is a `<label for>` above it and the error lives in a Field slot
 * below — a placeholder is never a label.
 */
const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(function Input({ className, type, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full rounded-md border border-border bg-surface-sunken px-3 text-body text-ink",
        "placeholder:text-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "aria-[invalid=true]:border-danger",
        "transition-colors duration-fast ease-standard",
        DISABLED,
        "disabled:opacity-45",
        className
      )}
      {...props}
    />
  );
});

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-md border border-border bg-surface-sunken px-3 py-2 text-body text-ink",
        "placeholder:text-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "aria-[invalid=true]:border-danger",
        "transition-colors duration-fast ease-standard",
        "disabled:pointer-events-none disabled:opacity-45",
        className
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
