import * as React from "react";

import { cn } from "@/lib/utils";

import type { BadgeTone } from "./Badge";

const STATUS_DOT: Record<BadgeTone, string> = {
  neutral: "bg-white/60",
  accent: "bg-white",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

type MastheadProps = {
  /** Mono eyebrow — the console or section this screen belongs to. */
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The screen's single standing state. Omit where there isn't one. */
  status?: { label: string; tone: BadgeTone };
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Every top-level screen opens with this. It is the single biggest reason the
 * consoles feel like one application — so it is reused verbatim rather than
 * re-invented per console.
 */
function Masthead({
  eyebrow,
  title,
  description,
  status,
  actions,
  className,
}: MastheadProps) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl bg-scaler-depth p-7 shadow-lg",
        className
      )}
    >
      {/* One soft light source. Never an animated orb. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-white/10 blur-3xl"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-micro uppercase tracking-wider text-white/70">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-h1 font-semibold tracking-tight text-white">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-prose text-body text-white/70">
              {description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {status && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-caption font-semibold text-white ring-1 ring-inset ring-white/20">
              <span
                aria-hidden
                className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status.tone])}
              />
              {status.label}
            </span>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
}

export { Masthead };
export type { MastheadProps };
