import type React from "react";

import { cn } from "@/lib/utils";

type InfoCardProps = {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  className?: string;
};

export function InfoCard({ icon, label, value, className }: InfoCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
