import type React from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="relative">
        <div className="absolute -left-3 top-0 bottom-0 w-0.5 rounded-full bg-linear-to-b from-primary/40 to-transparent max-sm:hidden" />
        {typeof title === "string" ? (
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        ) : (
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        )}
        {description && (
          typeof description === "string" ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : (
            <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>
          )
        )}
      </div>
      {action && <div className="mt-2 sm:mt-0">{action}</div>}
    </div>
  );
}
