import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { StatCard } from "@/features/dashboard/components/StatCard";
import { WorkflowTimeline } from "@/features/workflows/components/WorkflowTimeline";

export default function StudentPage() {
  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Student Dashboard</h1>

        <p className="mt-2 text-muted-foreground">
          Manage your hostel leaves, QR passes, and movement activity.
        </p>
      </div>

      {/* STATS */}
      <section
        className="
          grid gap-4
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >
        <StatCard
          label="Active Leave"
          value="01"
          helperText="Currently approved"
        />

        <StatCard
          label="Pending Requests"
          value="02"
          helperText="Awaiting approvals"
        />

        <StatCard
          label="Movement Status"
          value="IN"
          helperText="Inside hostel"
        />

        <StatCard
          label="QR Status"
          value="VALID"
          helperText="Ready for scanning"
        />
      </section>

      {/* MAIN GRID */}
      <section
        className="
          grid gap-6
          lg:grid-cols-3
        "
      >
        {/* LEFT */}
        <div className="space-y-6 lg:col-span-2">
          <DashboardCard
            title="Current Leave"
            description="Your active leave request."
          >
            <div className="space-y-4">
              <div
                className="
                  flex items-center justify-between
                  rounded-xl bg-muted p-4
                "
              >
                <div>
                  <p className="font-medium">Long Leave</p>

                  <p className="text-sm text-muted-foreground">
                    Apr 20 → Apr 24
                  </p>
                </div>

                <div
                  className="
                    rounded-full bg-primary/10
                    px-3 py-1 text-sm
                    font-medium text-primary
                  "
                >
                  Approved
                </div>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard
            title="Approval Workflow"
            description="Track your leave approval progress."
          >
            <WorkflowTimeline
              steps={[
                {
                  title: "Leave Submitted",
                  description: "Your leave request was created.",
                  status: "completed",
                },
                {
                  title: "Parent Approval",
                  description: "Approved via SMS confirmation.",
                  status: "completed",
                },
                {
                  title: "Admin Approval",
                  description: "Awaiting hostel admin approval.",
                  status: "current",
                },
                {
                  title: "QR Generation",
                  description: "QR pass will be generated.",
                  status: "upcoming",
                },
              ]}
            />
          </DashboardCard>

          <DashboardCard
            title="Recent Movement"
            description="Latest movement activity."
          >
            <div className="space-y-4">
              {["EXIT Hostel A", "ENTER Campus", "ENTER Hostel A"].map(
                (item) => (
                  <div
                    key={item}
                    className="
                    flex items-center justify-between
                    border-b border-border pb-3
                    last:border-none
                  "
                  >
                    <p className="text-sm font-medium">{item}</p>

                    <span className="text-xs text-muted-foreground">
                      2 mins ago
                    </span>
                  </div>
                ),
              )}
            </div>
          </DashboardCard>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          <DashboardCard
            title="Quick Actions"
            description="Common student actions."
          >
            <div className="flex flex-col gap-3">
              <button
                className="
                  rounded-xl bg-primary px-4 py-3
                  text-sm font-medium
                  text-primary-foreground
                "
              >
                Raise New Leave
              </button>

              <button
                className="
                  rounded-xl border border-border
                  bg-background px-4 py-3
                  text-sm font-medium
                  transition-colors
                  hover:bg-accent
                "
              >
                View QR Pass
              </button>
            </div>
          </DashboardCard>

          <DashboardCard title="Policies" description="Important hostel rules.">
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>• Long leave restricted before exams</li>

              <li>• QR scan required during exit</li>

              <li>• Late returns require approval</li>
            </ul>
          </DashboardCard>
        </div>
      </section>
    </div>
  );
}
