import { CheckCircle2, Clock3 } from "lucide-react";

import { cn } from "@/lib/utils";

type WorkflowStatus =
  | "completed"
  | "current"
  | "upcoming";

type WorkflowStepProps = {
  title: string;
  description?: string;
  status: WorkflowStatus;
};

const statusStyles: Record<
  WorkflowStatus,
  string
> = {
  completed:
    "border-emerald-500 bg-emerald-500 text-white",

  current:
    "border-primary bg-primary text-primary-foreground",

  upcoming:
    "border-border bg-background text-muted-foreground",
};

export function WorkflowStep({
  title,
  description,
  status,
}: WorkflowStepProps) {
  return (
    <div className="flex gap-4">
      {/* ICON */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            `
              flex size-10 items-center justify-center
              rounded-full border-2
            `,
            statusStyles[status]
          )}
        >
          {status === "completed" ? (
            <CheckCircle2 className="size-5" />
          ) : (
            <Clock3 className="size-5" />
          )}
        </div>

        <div className="mt-2 h-full w-px bg-border" />
      </div>

      {/* CONTENT */}
      <div className="pb-8">
        <h3 className="font-medium">
          {title}
        </h3>

        {description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}