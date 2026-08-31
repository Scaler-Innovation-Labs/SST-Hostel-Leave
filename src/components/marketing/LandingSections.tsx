import {
  BarChart3,
  Building2,
  QrCode,
  Scale,
  ShieldCheck,
  UsersRound,
  Workflow,
} from "lucide-react";
import type React from "react";

import { TECH_LABEL } from "@/design-system/sst";

type Feature = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    Icon: ShieldCheck,
    title: "Parent approval by link",
    body: "A tokenised link that expires on its own. Parents approve without an account, a password, or an app.",
  },
  {
    Icon: QrCode,
    title: "QR movement tracking",
    body: "A hashed, expiring pass scoped to the approved window, scanned at the gate on the way out and back.",
  },
  {
    Icon: UsersRound,
    title: "Role-based operations",
    body: "Separate consoles for students, POCs, admins and super admins, each showing only what that role acts on.",
  },
  {
    Icon: Workflow,
    title: "Configured workflows",
    body: "Approval chains come from configuration, not code, so a new step is a setting rather than a release.",
  },
  {
    Icon: Scale,
    title: "Policy-driven rules",
    body: "Leave types open and close against institutional policy, and every refusal explains itself.",
  },
  {
    Icon: BarChart3,
    title: "Operational analytics",
    body: "Approval times, hostel occupancy and movement trends, drawn from the same records the consoles use.",
  },
];

const STEPS = [
  {
    title: "A student requests leave",
    body: "Dynamic forms ask for exactly what that leave type needs, and nothing more.",
  },
  {
    title: "A parent approves by link",
    body: "The link is tokenised and expires on its own. No login, no app, no password.",
  },
  {
    title: "The POC or admin reviews",
    body: "Role-scoped queues route each step to whoever is supposed to decide it.",
  },
  {
    title: "A gate pass is issued",
    body: "Hashed and expiring, valid only for the window that was actually approved.",
  },
  {
    title: "The guard scans it",
    body: "Preview, then confirm. Every state change is recorded as a movement event.",
  },
];

export function FeatureSection() {
  return (
    <section id="features" className="mx-auto w-full max-w-content px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <h2 className="text-h2 tracking-tight text-ink">What it does</h2>
        <span className={TECH_LABEL}>Six capabilities</span>
      </div>

      <div className="mt-8 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ Icon, title, body }) => (
          <div key={title}>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent ring-1 ring-inset ring-accent/10">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-4 text-h3 text-ink">{title}</h3>
            <p className="mt-2 text-body text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The dark moment that gives the page its rhythm: white → navy → white. One
 * band, not a gradient on every section.
 */
export function WorkflowBand() {
  return (
    <section id="workflow" className="bg-surface-navy py-16 text-white">
      <div className="mx-auto w-full max-w-content px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-micro uppercase tracking-wider text-white/60">
          How a leave moves
        </p>
        <h2 className="mt-2 max-w-2xl text-h2 tracking-tight text-white">
          Five steps, each one recorded
        </h2>

        <ol className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex items-baseline gap-6 py-5">
              <span className="font-mono text-micro tabular-nums text-white/50">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="text-body-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-1 text-body text-white/70">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function SeparationSection() {
  return (
    <section
      id="security"
      className="mx-auto w-full max-w-content px-4 py-16 sm:px-6 lg:px-8"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <h2 className="text-h2 tracking-tight text-ink">
          Permission and reality, kept apart
        </h2>
      </div>

      <div className="mt-8 grid gap-10 sm:grid-cols-2">
        <div>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent ring-1 ring-inset ring-accent/10">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="mt-4 text-h3 text-ink">Leave is permission</h3>
          <p className="mt-2 text-body text-muted">
            An approved request says a student is allowed to go. It says nothing
            about where they actually are.
          </p>
        </div>

        <div>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-light text-success ring-1 ring-inset ring-success/10">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="mt-4 text-h3 text-ink">Movement is reality</h3>
          <p className="mt-2 text-body text-muted">
            Every scan at the gate writes a movement event. That record — not
            the approval — is what says who is on campus right now.
          </p>
        </div>
      </div>
    </section>
  );
}
