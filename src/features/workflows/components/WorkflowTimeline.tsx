import { WorkflowStep } from "./WorkflowStep";

type WorkflowTimelineProps = {
  steps: {
    title: string;
    description?: string;
    status:
      | "completed"
      | "current"
      | "upcoming";
  }[];
};

export function WorkflowTimeline({
  steps,
}: WorkflowTimelineProps) {
  return (
    <div>
      {steps.map((step, index) => (
        <WorkflowStep
          key={index}
          title={step.title}
          description={step.description}
          status={step.status}
        />
      ))}
    </div>
  );
}