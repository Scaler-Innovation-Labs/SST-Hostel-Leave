import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils";

import { FOCUS } from "./interaction";

type RowTone = "accent" | "success" | "warning" | "danger" | "info" | "neutral";

const TILE_TONE: Record<RowTone, string> = {
  accent: "bg-accent-light text-accent ring-accent/10",
  success: "bg-success-light text-success ring-success/10",
  warning: "bg-warning-light text-warning ring-warning/10",
  danger: "bg-danger-light text-danger ring-danger/10",
  info: "bg-info-light text-info ring-info/10",
  neutral: "bg-surface text-muted ring-border",
};

type EditorialRowProps = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  meta?: string;
  tone?: RowTone;
  /** Makes the whole row a link — which is what earns it the hover lift. */
  href?: string;
  trailing?: React.ReactNode;
  className?: string;
};

/**
 * The editorial list row that replaces a card grid. 40px icon tile, title and
 * meta, optional trailing controls. A link row lifts; a static row does not —
 * movement is a promise that something happens when you click.
 */
function EditorialRow({
  Icon,
  title,
  meta,
  tone = "accent",
  href,
  trailing,
  className,
}: EditorialRowProps) {
  const body = (
    <>
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
          TILE_TONE[tone]
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-small font-semibold text-ink">{title}</span>
        {meta && (
          <span className="block truncate text-caption text-muted">{meta}</span>
        )}
      </span>
      {trailing}
    </>
  );

  const base =
    "flex items-center gap-3.5 rounded-xl border border-border bg-surface-sunken p-4 transition-all duration-base ease-standard";

  if (!href) {
    return <div className={cn(base, className)}>{body}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        base,
        "hover:-translate-y-0.5 hover:border-accent/30 hover:bg-surface-hover hover:shadow-raised-lift active:translate-y-px",
        FOCUS,
        className
      )}
    >
      {body}
    </Link>
  );
}

export { EditorialRow };
export type { EditorialRowProps, RowTone };
