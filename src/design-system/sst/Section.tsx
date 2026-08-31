import * as React from "react";

import { cn } from "@/lib/utils";

type SectionProps = {
  title: string;
  /** A mono counter, shown when no action is supplied. */
  meta?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** A heading with a rule and a technical counter. Page-level, not card-level. */
function Section({ title, meta, action, className, children }: SectionProps) {
  return (
    <section className={cn("mt-14 first:mt-0", className)}>
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <h2 className="text-h3 text-ink">{title}</h2>
        {action ?? (
          meta && (
            <span className="font-mono text-micro uppercase tracking-wider text-muted">
              {meta}
            </span>
          )
        )}
      </div>
      {children}
    </section>
  );
}

type BandTone = "navy" | "ink" | "blue";

const BAND_TONE: Record<BandTone, string> = {
  navy: "bg-surface-navy",
  ink: "bg-surface-ink",
  blue: "bg-accent",
};

type BandProps = {
  tone?: BandTone;
  className?: string;
  children: React.ReactNode;
};

/**
 * The dark moment that creates page rhythm: white → blue → black → white.
 * Pulls itself out of the page gutter to span edge to edge, so the gutter
 * values here must match the page container's.
 */
function Band({ tone = "navy", className, children }: BandProps) {
  return (
    <section
      className={cn(
        "-mx-4 px-4 py-10 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        BAND_TONE[tone],
        "text-white",
        className
      )}
    >
      {children}
    </section>
  );
}

type Stat = {
  label: string;
  value: React.ReactNode;
  unit?: string;
};

/** Large numbers on a baseline grid. Replaces three centred stat cards. */
function StatRow({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl className={cn("flex flex-wrap gap-x-12 gap-y-6", className)}>
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="font-mono text-micro uppercase tracking-wider text-muted">
            {stat.label}
          </dt>
          <dd className="mt-1 flex items-baseline gap-1 text-h1 tabular-nums text-ink">
            {stat.value}
            {stat.unit && (
              <span className="text-h3 text-muted">{stat.unit}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The editorial list that replaces a card grid. */
function RowList({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("divide-y divide-border border-b border-border", className)}
      {...props}
    />
  );
}

export { Band, RowList, Section, StatRow };
export type { BandTone, Stat };
