import { Reveal } from "@/components/marketing/Reveal";

export function ProductPreviewSection() {
  return (
    <section
      id="security"
      className="relative py-16 md:py-20"
    >
      <div className="relative mx-auto max-w-7xl px-8">
        <Reveal>
          <div className="max-w-3xl">
          <div
            className="
              inline-flex items-center gap-2
              rounded-full border border-border
              bg-surface-sunken/40 px-4 py-1.5
              text-body text-muted
            "
          >
            Operational Visibility
          </div>

          <h2
            className="
              mt-6 text-h1 font-semibold
              tracking-tight
              sm:text-display
            "
          >
            Designed for real hostel
            operations and campus workflows.
          </h2>

          <p
            className="
              mt-6 max-w-2xl
              text-h3 leading-8
              text-muted
            "
          >
            Monitor approvals, movement,
            occupancy, QR verification,
            and operational workflows
            from a centralized platform.
          </p>
          </div>
        </Reveal>

        <div
          className="
            mt-20 grid gap-6
            lg:grid-cols-12
          "
        >
          <Reveal className="lg:col-span-7">
          <div
            className="
              relative h-full overflow-hidden
              rounded-3xl border border-border
              bg-card/50 p-8
              backdrop-blur-xl
            "
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body text-muted">
                  Live Approval Queue
                </p>

                <h3 className="mt-2 text-h2 font-semibold">
                  Realtime leave monitoring
                </h3>
              </div>

              <div
                className="
                  rounded-full bg-success-light
                  px-3 py-1 text-caption
                  font-medium text-success
                "
              >
                Live
              </div>
            </div>

            <div className="mt-10 space-y-4">
              {[
                {
                  name: "23B81A0501",
                  status: "Parent Approved",
                },
                {
                  name: "23B81A0517",
                  status: "POC Pending",
                },
                {
                  name: "24B81A1102",
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

                    <p className="mt-1 text-body text-muted">
                      Long Leave
                    </p>
                  </div>

                  <div
                    className="
                      rounded-full border border-border
                      bg-card px-3 py-1
                      text-caption text-muted
                    "
                  >
                    {item.status}
                  </div>
                </div>
              ))}
            </div>

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
                  <p className="text-caption text-muted">
                    {item.label}
                  </p>

                  <h3 className="mt-2 text-h2 font-semibold">
                    {item.value}
                  </h3>
                </div>
              ))}
            </div>
          </div>
          </Reveal>

          <Reveal className="lg:col-span-5" delay={150}>
            <div className="h-full space-y-6">
            <div
              className="
                rounded-3xl border border-border
                bg-card/50 p-8
                backdrop-blur-xl
              "
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-body text-muted">
                    QR Verification
                  </p>

                  <h3 className="mt-2 text-h2 font-semibold">
                    Secure movement tracking
                  </h3>
                </div>

                <div
                  className="
                    rounded-full bg-primary/10
                    px-3 py-1 text-caption
                    font-medium text-primary
                  "
                >
                  Active
                </div>
              </div>

              <div
                className="
                  mt-8 flex items-center
                  justify-center
                "
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static demo asset, no optimization needed */}
                <img
                  src="/demo-qr.png"
                  alt="Demo QR pass"
                  width={176}
                  height={176}
                  className="rounded-xl bg-white p-3"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>

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
                      text-body text-muted
                    "
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="
                rounded-3xl border border-border
                bg-card/50 p-8
                backdrop-blur-xl
              "
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-body text-muted">
                    Movement Activity
                  </p>

                  <h3 className="mt-2 text-h2 font-semibold">
                    Live hostel movement
                  </h3>
                </div>

                <div
                  className="
                    rounded-full bg-success-light
                    px-3 py-1 text-caption
                    font-medium text-success
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
                  "Failed scan — Gate B",
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

                      <p className="text-body">
                        {item}
                      </p>
                    </div>

                    <span className="text-caption text-muted">
                      2m ago
                    </span>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
