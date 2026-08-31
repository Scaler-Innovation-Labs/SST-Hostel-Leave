import {
  FileText,
  MailCheck,
  QrCode,
  ScanLine,
  UserCheck,
} from "lucide-react";

import { Reveal } from "@/components/marketing/Reveal";

const workflowSteps = [
  {
    icon: FileText,
    title: "Student raises leave",
    desc: "Dynamic forms capture exactly what each leave type needs.",
  },
  {
    icon: MailCheck,
    title: "Parent approves via secure link",
    desc: "Tokenized approval link — no login, expires automatically.",
  },
  {
    icon: UserCheck,
    title: "POC/Admin reviews request",
    desc: "Role-scoped dashboards route each step to the right approver.",
  },
  {
    icon: QrCode,
    title: "QR pass generated",
    desc: "Hashed, expiring credential scoped to the approved window.",
  },
  {
    icon: ScanLine,
    title: "Guard scans during movement",
    desc: "Preview-then-confirm scanning records every state transition.",
  },
];

export function WorkflowSection() {
  return (
    <section
      id="workflow"
      className="py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-8">
        <Reveal>
          <div className="max-w-2xl">
            <h2 className="text-h1 font-semibold tracking-tight">
              One lifecycle, end to end.
            </h2>

            <p className="mt-4 text-h3 text-muted">
              Every leave follows a transparent path from request to verified
              movement — nothing happens outside the record.
            </p>
          </div>
        </Reveal>

        <div className="relative mt-16">
          {/* Connector line — desktop only, runs behind the step badges */}
          <div
            aria-hidden
            className="
              absolute left-0 right-0 top-5 hidden h-px
              bg-linear-to-r from-transparent via-primary/40 to-transparent
              lg:block
            "
          />

          <div className="grid gap-6 lg:grid-cols-5">
            {workflowSteps.map((step, index) => (
              <Reveal key={step.title} delay={index * 120}>
                <div
                  className="
                    relative h-full rounded-2xl border
                    border-border bg-card p-6 transition-colors hover:bg-surface-hover
                  "
                >
                  <div
                    className="
                      relative mb-6 flex size-10 items-center
                      justify-center rounded-full border border-primary/20
                      bg-background text-primary shadow-[0_0_24px_rgba(59,130,246,0.15)]
                    "
                  >
                    <step.icon className="size-5" />
                  </div>

                  <p className="text-caption font-medium uppercase tracking-[0.14em] text-muted">
                    Step {index + 1}
                  </p>

                  <h3 className="mt-2 font-medium leading-snug">
                    {step.title}
                  </h3>

                  <p className="mt-3 text-body leading-6 text-muted">
                    {step.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
