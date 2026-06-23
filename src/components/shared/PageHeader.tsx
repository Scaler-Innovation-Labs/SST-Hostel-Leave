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
      <div>
        {typeof title === "string" ? (
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        )}
        {description && (
          typeof description === "string" ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">{description}</div>
          )
        )}
      </div>
      {action && <div className="mt-2 sm:mt-0">{action}</div>}
    </div>
  );
}
