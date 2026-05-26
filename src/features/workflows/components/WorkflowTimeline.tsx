type WorkflowStep = {
  title: string;
  description: string;
  status: "completed" | "current" | "upcoming";
};

type WorkflowTimelineProps = {
  steps: WorkflowStep[];
};

const statusClasses: Record<WorkflowStep["status"], string> = {
  completed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
  current: "border-primary/20 bg-primary/10 text-primary",
  upcoming: "border-border bg-muted text-muted-foreground",
};

export function WorkflowTimeline({
  steps,
}: WorkflowTimelineProps) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="flex gap-4"
        >
          <div className="flex flex-col items-center">
            <div
              className={
                `flex size-8 items-center justify-center rounded-full border text-xs font-semibold ${statusClasses[step.status]}`
              }
            >
              {index + 1}
            </div>

            {index < steps.length - 1 && (
              <div className="mt-2 h-full w-px bg-border" />
            )}
          </div>

          <div className="pb-1">
            <h4 className="text-sm font-medium">
              {step.title}
            </h4>

            <p className="mt-1 text-sm text-muted-foreground">
              {step.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
