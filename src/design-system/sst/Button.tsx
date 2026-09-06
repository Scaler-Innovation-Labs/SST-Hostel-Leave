import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

import { DISABLED, FOCUS } from "./interaction";

/**
 * Six meanings, not eleven variants. Each one answers "what is this action
 * for", so there is never a question of which to reach for.
 *
 * Filled status controls carry `text-on-fill`: white in light mode, ink in
 * dark, because the dark palette lightens every hue past the point where a
 * white label clears 4.5:1.
 */
const buttonVariants = cva(
  [
    "group inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-ui font-medium rounded-md",
    "transition-all duration-fast ease-standard",
    // Press settles. Nothing scales — scaling resamples the text and reads as a toy.
    "active:translate-y-px",
    FOCUS,
    DISABLED,
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** The one action that matters on the surface. */
        primary:
          "bg-accent text-on-fill shadow-glow hover:bg-accent-dark active:bg-accent-dark dark:hover:text-white dark:active:text-white",
        /** Authority, not identity. Where blue would over-claim. */
        ink: "bg-ink text-surface hover:bg-ink/90",
        /** Everything alongside a primary. Visible 3:1 edge, no fill. */
        outline:
          "bg-transparent text-ink border border-border-strong hover:bg-surface-hover hover:border-ink",
        /** Tertiary — toolbars, dismissals. */
        ghost: "text-muted hover:bg-surface-hover hover:text-ink",
        /** Destructive and irreversible. Always behind a confirmation. */
        danger: "bg-danger text-on-fill hover:bg-danger/90",
        /** On a navy or black band. The label stays dark in both themes:
            `text-ink` turns near-white in dark mode and vanishes on the
            always-white fill. */
        onDark: "bg-white text-surface-ink hover:bg-white/90",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-small",
        md: "h-10 rounded-md px-4 text-body",
        lg: "h-12 rounded-lg px-6 text-body-lg",
        /** Field mode — 64px for gloved, one-handed, outdoor use. */
        guard: "h-16 rounded-xl px-8 text-h3 font-semibold min-w-16",
        icon: "h-10 w-10 rounded-md p-0",
        iconGuard: "h-16 w-16 rounded-xl p-0",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  }
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Sets `disabled` and `aria-busy`, swaps in a loader. */
    loading?: boolean;
    /** What the control says while it works — a verb in the present tense. */
    loadingText?: string;
    /**
     * The signature micro-interaction: on hover the label holds still and the
     * arrow advances 4px. Forward motion, not a wobbling control. Use on
     * forward actions, never on destructive ones.
     */
    trailingArrow?: boolean;
  };

function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  loadingText,
  trailingArrow = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  // A slotted child owns its own content; a loader or arrow injected alongside
  // it would give Slot two children and throw.
  const content = asChild ? (
    children
  ) : (
    <>
      {loading && (
        <LoaderCircle
          className="h-4 w-4 animate-spin"
          aria-hidden
        />
      )}
      {loading && loadingText ? loadingText : children}
      {trailingArrow && !loading && (
        <ArrowRight
          className="h-4 w-4 transition-transform duration-fast ease-standard group-hover:translate-x-1"
          aria-hidden
        />
      )}
    </>
  );

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled ?? (loading || undefined)}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </Comp>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
