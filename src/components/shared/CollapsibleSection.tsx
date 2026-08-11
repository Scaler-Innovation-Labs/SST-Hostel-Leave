"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type CollapsibleSectionProps = {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
};

export function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children, action }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!children) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between p-6">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-left"
        >
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </h3>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
      </div>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}
