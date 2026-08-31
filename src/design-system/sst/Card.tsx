import * as React from "react";

import { cn } from "@/lib/utils";

import { HOVER_LIFT } from "./interaction";

type CardProps = React.ComponentProps<"div"> & {
  /** The whole card is a link or a control: it lifts on hover. */
  interactive?: boolean;
};

/**
 * One variant, down from nine. Depth is a value step first (`bg-surface` over
 * `bg-bg`), then the sheen plus two shadows, and the hairline border last.
 */
function Card({ className, interactive = false, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-xl border border-border bg-surface shadow-raised",
        interactive && [
          "cursor-pointer",
          HOVER_LIFT,
          "focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-bg",
        ],
        className
      )}
      {...props}
    />
  );
}

/** Sub-parts use `p-card`, so padding follows [data-density]. */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1 p-card", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-h3 text-ink", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-body text-muted", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-card pt-0", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 p-card pt-0", className)}
      {...props}
    />
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
