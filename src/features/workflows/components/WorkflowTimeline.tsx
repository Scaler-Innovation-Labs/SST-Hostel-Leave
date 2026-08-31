type WorkflowStep = {
  title: string;
  description: string;
  status: "completed" | "current" | "upcoming";
};

type WorkflowTimelineProps = {
  steps: WorkflowStep[];
};

const statusClasses: Record<WorkflowStep["status"], string> = {
  completed: "border-success/20 bg-success-light text-success",
  current: "border-accent/20 bg-accent/10 text-accent",
  upcoming: "border-border bg-surface-sunken text-muted",
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
                `flex size-8 items-center justify-center rounded-full border text-caption font-semibold ${statusClasses[step.status]}`
              }
            >
              {index + 1}
            </div>

            {index < steps.length - 1 && (
              <div className="mt-2 h-full w-px bg-border" />
            )}
          </div>

          <div className="pb-1">
            <h4 className="text-body font-medium">
              {step.title}
            </h4>

            <p className="mt-1 text-body text-muted">
              {step.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
