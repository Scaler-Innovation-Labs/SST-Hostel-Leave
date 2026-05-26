const workflowSteps = [
  "Student raises leave",
  "Parent approves via SMS",
  "POC/Admin reviews request",
  "QR pass generated",
  "Guard scans during movement",
];

export function WorkflowSection() {
  return (
    <section
      id="workflow"
      className="py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-8">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-bold tracking-tight">
            Designed around operational
            workflows.
          </h2>

          <p className="mt-4 text-lg text-muted-foreground">
            Every leave request follows a
            transparent approval and movement
            lifecycle.
          </p>
        </div>

        <div
          className="
            mt-16 grid gap-6
            lg:grid-cols-5
          "
        >
          {workflowSteps.map((step, index) => (
            <div
              key={step}
              className="
                relative rounded-2xl
                border border-border
                bg-card p-6
              "
            >
              <div
                className="
                  mb-6 flex size-10
                  items-center justify-center
                  rounded-full bg-primary/10
                  text-sm font-semibold text-primary
                "
              >
                {index + 1}
              </div>

              <h3 className="font-medium">
                {step}
              </h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
