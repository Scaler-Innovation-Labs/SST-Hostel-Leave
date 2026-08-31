import * as React from "react";

import { cn } from "@/lib/utils";

type SectionCardProps = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  /** Mono counter — "12 pending", "3 hostels". */
  meta?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** Icon + title over a hairline rule, optional mono count, optional action. */
function SectionCard({
  Icon,
  title,
  meta,
  action,
  className,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 shadow-raised",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <h2 className="text-small font-semibold text-ink">{title}</h2>
          {meta && (
            <span className="font-mono text-micro uppercase tracking-wider text-muted">
              {meta}
            </span>
          )}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export { SectionCard };
export type { SectionCardProps };
