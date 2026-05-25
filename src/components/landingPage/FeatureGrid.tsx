const features = [
  {
    title: "Parent SMS Approval",
    description:
      "Parents approve leave requests directly through SMS responses.",
  },
  {
    title: "QR Movement Tracking",
    description:
      "Track hostel movement using secure QR scans and guard verification.",
  },
  {
    title: "Role-Based Operations",
    description:
      "Dedicated dashboards for students, POCs, admins, and super admins.",
  },
  {
    title: "Workflow Visibility",
    description:
      "Track approvals, escalations, and movement activity in real time.",
  },
  {
    title: "Policy-Driven Rules",
    description:
      "Restrict leave types dynamically based on institutional policies.",
  },
  {
    title: "Operational Analytics",
    description:
      "Gain visibility into approvals, hostel occupancy, and movement trends.",
  },
];

export function FeatureGrid() {
  return (
    <section
      id="features"
      className="py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-8">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-bold tracking-tight">
            Built for operational clarity.
          </h2>

          <p className="mt-4 text-lg text-muted-foreground">
            Streamline approvals, movement,
            and communication workflows across
            institutions.
          </p>
        </div>

        <div
          className="
            mt-16 grid gap-6
            md:grid-cols-2
            xl:grid-cols-3
          "
        >
          {features.map((feature) => (
            <div
              key={feature.title}
              className="
                rounded-2xl border border-border
                bg-card p-6
                transition-colors
                hover:bg-accent/40
              "
            >
              <h3 className="text-lg font-semibold">
                {feature.title}
              </h3>

              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}