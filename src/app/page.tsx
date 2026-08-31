import { ArrowRight, ScanLine } from "lucide-react";
import Link from "next/link";

import {
  FeatureSection,
  SeparationSection,
  WorkflowBand,
} from "@/components/marketing/LandingSections";
import { Logo } from "@/components/shared/Logo";
import { ROUTES } from "@/constants/routes";
import { Button, TECH_LABEL } from "@/design-system/sst";

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "What it does", href: "#features" },
      { label: "How a leave moves", href: "#workflow" },
      { label: "Permission and reality", href: "#security" },
    ],
  },
  {
    heading: "Consoles",
    links: [
      { label: "Student", href: ROUTES.STUDENT_DASHBOARD },
      { label: "POC", href: ROUTES.POC_DASHBOARD },
      { label: "Admin", href: ROUTES.ADMIN_DASHBOARD },
      { label: "Gate scanner", href: ROUTES.GUARD_SCANNER },
    ],
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-surface supports-[backdrop-filter]:bg-surface/70 supports-[backdrop-filter]:backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-content items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="ml-auto hidden items-center gap-6 md:flex">
            {FOOTER_COLUMNS[0]?.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-small font-medium text-muted transition-colors duration-fast ease-standard hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <Button asChild size="sm" className="max-md:ml-auto">
            <Link href={ROUTES.LOGIN}>Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/*
          The masthead shape every console opens with, at page scale. One soft
          light source — no orb field, no animated gradient.
        */}
        <section className="relative overflow-hidden bg-scaler-depth">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-white/10 blur-3xl"
          />
          <div className="relative mx-auto w-full max-w-content px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <p className="font-mono text-micro uppercase tracking-wider text-white/70">
              SST Hostel Leave
            </p>
            <h1 className="mt-4 max-w-3xl text-display font-semibold tracking-tight text-white">
              Leave, approved and accounted for.
            </h1>
            <p className="mt-5 max-w-xl text-body-lg text-white/70">
              Students request leave, parents approve it by link, and the gate
              records who actually came and went. One record, end to end.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="onDark" trailingArrow>
                <Link href={ROUTES.LOGIN}>
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Link
                href={ROUTES.GUARD_SCANNER}
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-body font-medium text-white/80 transition-colors duration-fast ease-standard hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ScanLine className="h-4 w-4" aria-hidden />
                Open the gate scanner
              </Link>
            </div>
          </div>
        </section>

        <FeatureSection />
        <WorkflowBand />
        <SeparationSection />
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid w-full max-w-content gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto_auto] lg:px-8">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-body text-muted">
              Campus leave and movement management — approvals, gate passes and
              an audit trail, in one platform.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className={TECH_LABEL}>{column.heading}</h2>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-body text-muted transition-colors duration-fast ease-standard hover:text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mx-auto flex w-full max-w-content items-center justify-between gap-4 border-t border-border px-4 py-6 sm:px-6 lg:px-8">
          <p className={TECH_LABEL}>SST Hostel Leave</p>
          <p className={TECH_LABEL}>Scaler School of Technology</p>
        </div>
      </footer>
    </div>
  );
}
