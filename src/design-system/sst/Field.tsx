import * as React from "react";

import { cn } from "@/lib/utils";

type FieldProps = {
  /** Must match the control's `id` — a real `<label for>`, not a caption. */
  htmlFor: string;
  label: string;
  /** Shown below the control and wired via `aria-describedby`. */
  hint?: string;
  /**
   * States the field and the fix, not "Invalid input". Rendered with
   * `role="alert"` so a screen reader announces it when it appears.
   */
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * The wrapper that makes a control accessible by construction: a real label,
 * a described-by hint, and an error slot that names the field and the fix.
 */
function Field({
  htmlFor,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-small font-medium text-ink"
      >
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>

      {children}

      {hint && !error && (
        <p id={hintId} className="text-caption text-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The ids a `Field` expects its control to carry. Spread onto the input so the
 * wiring cannot drift from the markup above.
 */
function fieldControlProps(
  id: string,
  { hint, error }: { hint?: string; error?: string }
) {
  const describedBy = [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return {
    id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy || undefined,
  };
}

export { Field, fieldControlProps };
