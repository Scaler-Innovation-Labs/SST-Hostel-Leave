export function ProductPreviewSection() {
  return (
    <section
      id="security"
      className="relative py-16 md:py-20"
    >
      <div className="relative mx-auto max-w-7xl px-8">
        {/* HEADER */}
        <div className="max-w-3xl">
          <div
            className="
              inline-flex items-center gap-2
              rounded-full border border-border
              bg-muted/40 px-4 py-1.5
              text-sm text-muted-foreground
            "
          >
            Operational Visibility
          </div>

          <h2
            className="
              mt-6 text-4xl font-bold
              tracking-tight
              sm:text-5xl
            "
          >
            Designed for real hostel
            operations and campus workflows.
          </h2>

          <p
            className="
              mt-6 max-w-2xl
              text-lg leading-8
              text-muted-foreground
            "
          >
            Monitor approvals, movement,
            occupancy, QR verification,
            and operational workflows
            from a centralized platform.
          </p>
        </div>

        {/* MAIN GRID */}
        <div
          className="
            mt-20 grid gap-6
            lg:grid-cols-12
          "
        >
          {/* LARGE LEFT PANEL */}
          <div
            className="
              relative overflow-hidden
              rounded-3xl border border-border
              bg-card/50 p-8
              backdrop-blur-xl
              lg:col-span-7
            "
          >
            {/* HEADER */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Live Approval Queue
                </p>

                <h3 className="mt-2 text-2xl font-semibold">
                  Realtime leave monitoring
                </h3>
              </div>

              <div
                className="
                  rounded-full bg-emerald-500/10
                  px-3 py-1 text-xs
                  font-medium text-emerald-400
                "
              >
                Live
              </div>
            </div>

            {/* TABLE */}
            <div className="mt-10 space-y-4">
              {[
                {
                  name: "Rahul Sharma",
                  status: "Parent Approved",
                },
                {
                  name: "Ananya Reddy",
                  status: "POC Pending",
                },
                {
                  name: "Veda Varshit",
                  status: "Admin Approval",
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="
                    flex items-center justify-between
                    rounded-2xl border border-border
                    bg-background/40 p-4
                  "
                >
                  <div>
                    <p className="font-medium">
                      {item.name}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Long Leave
                    </p>
                  </div>

                  <div
                    className="
                      rounded-full border border-border
                      bg-card px-3 py-1
                      text-xs text-muted-foreground
                    "
                  >
                    {item.status}
                  </div>
                </div>
              ))}
            </div>

            {/* BOTTOM STATS */}
            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                {
                  label: "Pending",
                  value: "12",
                },
                {
                  label: "Approved",
                  value: "84",
                },
                {
                  label: "Rejected",
                  value: "04",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="
                    rounded-2xl border border-border
                    bg-background/40 p-4
                  "
                >
                  <p className="text-xs text-muted-foreground">
                    {item.label}
                  </p>

                  <h3 className="mt-2 text-2xl font-bold">
                    {item.value}
                  </h3>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6 lg:col-span-5">
            {/* QR CARD */}
            <div
              className="
                rounded-3xl border border-border
                bg-card/50 p-8
                backdrop-blur-xl
              "
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    QR Verification
                  </p>

                  <h3 className="mt-2 text-2xl font-semibold">
                    Secure movement tracking
                  </h3>
                </div>

                <div
                  className="
                    rounded-full bg-primary/10
                    px-3 py-1 text-xs
                    font-medium text-primary
                  "
                >
                  Active
                </div>
              </div>

              {/* QR */}
              <div
                className="
                  mt-8 flex items-center justify-center
                "
              >
                <div
                  className="
                    flex size-44 items-center
                    justify-center
                    rounded-3xl border border-border
                    bg-background
                    text-sm text-muted-foreground
                  "
                >
                  QR Preview
                </div>
              </div>

              {/* STATUS */}
              <div className="mt-8 space-y-4">
                {[
                  "Exit scan required",
                  "Realtime movement sync",
                  "Guard verification enabled",
                ].map((item) => (
                  <div
                    key={item}
                    className="
                      rounded-xl border border-border
                      bg-background/40 px-4 py-3
                      text-sm text-muted-foreground
                    "
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* MOVEMENT CARD */}
            <div
              className="
                rounded-3xl border border-border
                bg-card/50 p-8
                backdrop-blur-xl
              "
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Movement Activity
                  </p>

                  <h3 className="mt-2 text-2xl font-semibold">
                    Live hostel movement
                  </h3>
                </div>

                <div
                  className="
                    rounded-full bg-emerald-500/10
                    px-3 py-1 text-xs
                    font-medium text-emerald-400
                  "
                >
                  Synced
                </div>
              </div>

              <div className="mt-8 space-y-5">
                {[
                  "EXIT Hostel A",
                  "ENTER Campus",
                  "ENTER Hostel B",
                  "FAILED_SCAN",
                ].map((item) => (
                  <div
                    key={item}
                    className="
                      flex items-center justify-between
                    "
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="
                          size-2 rounded-full
                          bg-primary
                        "
                      />

                      <p className="text-sm">
                        {item}
                      </p>
                    </div>

                    <span className="text-xs text-muted-foreground">
                      2m ago
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}