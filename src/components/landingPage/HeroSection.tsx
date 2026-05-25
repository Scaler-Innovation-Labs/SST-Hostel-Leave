export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="
          relative mx-auto grid min-h-[72vh]
          max-w-7xl items-center gap-12
          px-8 py-10 md:py-12 lg:grid-cols-2
        "
      >
        {/* LEFT CONTENT */}
        <div className="relative z-10 max-w-xl">
          <div
            className="
              inline-flex items-center gap-2 rounded-full
              border border-white/5 bg-white/2 px-4 py-2
              text-sm text-white/60 backdrop-blur-xl
            "
          >
            <div className="size-2 rounded-full bg-blue-500" />
            Student Portal
          </div>

          <h1
            className="
              mt-8 text-5xl font-semibold leading-[0.95]
              tracking-[-0.04em] text-white sm:text-6xl xl:text-[5.5rem]
            "
          >
            Apply.
            <br />
            Get Approved.
            <br />
            Move Safely.
            <br />
            <span className="bg-linear-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              All in One Place.
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-8 text-white/50">
            Request leaves, get parent approval, receive your QR pass, and move in and out of campus securely.
          </p>

          <div className="mt-8">
            <button className="inline-flex items-center gap-3 rounded-2xl bg-linear-to-r from-blue-500 to-indigo-600 px-7 py-4 text-sm font-medium text-white shadow-[0_0_60px_rgba(59,130,246,0.35)] transition-all duration-300 hover:scale-[1.02]">
              Login to Dashboard
              <span>→</span>
            </button>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "New Leave Request",
                desc: "Apply for short leave, long leave or outing",
              },
              {
                title: "Approval Workflow",
                desc: "Parent → POC → Admin verification process",
              },
              {
                title: "QR Movement Pass",
                desc: "Secure exit/entry with QR code scanning",
              },
              {
                title: "Realtime Tracking",
                desc: "Live movement updates across campus",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/4 bg-white/2 p-5 backdrop-blur-xl"
              >
                <h3 className="text-sm font-medium text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/45">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-[2.25rem] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.68))] blur-3xl" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-[0_30px_80px_-35px_rgba(15,23,42,0.95)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/8 bg-white/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="size-3 rounded-full bg-red-500" />
                <div className="size-3 rounded-full bg-yellow-500" />
                <div className="size-3 rounded-full bg-green-500" />
              </div>

              <div className="text-sm font-medium text-white/60">SST Leave Dashboard</div>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Pending", value: "12" },
                  { label: "Approved", value: "84" },
                  { label: "Inside", value: "1,842" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border bg-white/4 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-white/40">{item.label}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{item.value}</h3>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-border bg-white/4 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">Leave Workflow</h3>
                    <p className="mt-1 text-sm text-white/45">Awaiting admin approval</p>
                  </div>

                  <div className="rounded-full border border-amber-400/15 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                    Pending
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-center">
                  {[
                    "Student",
                    "Parent",
                    "POC",
                    "Admin",
                    "QR",
                  ].map((step, index) => (
                    <div key={step} className="flex items-center gap-3">
                      <div className="rounded-full border border-white/8 bg-white/5 px-3 py-2 text-xs text-white/75">
                        {step}
                      </div>

                      {index !== 4 && <div className="h-px w-6 bg-border" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white/4 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">Recent Movement</h3>

                  <div className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                    Live
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {[
                    "EXIT Hostel A",
                    "ENTER Campus",
                    "ENTER Hostel B",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/3 px-4 py-3"
                    >
                      <p className="text-sm text-white/80">{item}</p>
                      <span className="text-xs text-white/40">2m ago</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">QR Generated</p>
                    <p className="mt-1 text-xs text-white/45">Ready for exit scan</p>
                  </div>

                  <div className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                    Active
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-center">
                  <div className="flex h-44 w-44 items-center justify-center rounded-3xl border border-white/8 bg-white/5 text-sm text-white/45">
                    QR Preview
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
