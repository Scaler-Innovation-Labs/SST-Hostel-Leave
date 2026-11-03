"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Mail,
  MessageSquare,
  QrCode,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PARENT_APPROVAL_TOKEN_EXPIRY_HOURS } from "@/constants/parent/parent-approval";
import { ROUTES } from "@/constants/routes";
import {
  Button,
  Masthead,
  SectionCard,
} from "@/design-system/sst";
import { cn } from "@/lib/utils";

type TabId = "overview" | "types" | "parent-sms" | "qr-pass" | "faqs";

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview & Workflow", icon: Sparkles },
  { id: "types", label: "Leave Types", icon: FileText },
  { id: "parent-sms", label: "Parent SMS & Approval", icon: Smartphone },
  { id: "qr-pass", label: "QR Pass & Gate Scanning", icon: QrCode },
  { id: "faqs", label: "FAQs & Rules", icon: HelpCircle },
];

const LEAVE_TYPES_INFO = [
  {
    code: "GENERAL_LEAVE",
    name: "General Leave (Overnight / Vacation)",
    description: "For traveling home, family visits, or overnight stays outside campus.",
    requiresParent: true,
    requiresWarden: true,
    qrType: "Exit & Return Pass",
    tips: "Parent SMS approval is mandatory before the warden can approve.",
  },
  {
    code: "LATE_ENTRY",
    name: "Late Entry (Curfew Extension)",
    description: "For returning to your hostel block past standard night curfew.",
    requiresParent: true,
    requiresWarden: true,
    qrType: "Return Pass Only",
    tips: "Ensure your reason and expected return time are explicitly stated.",
  },
  {
    code: "LATE_STAY_COLLEGE",
    name: "Late Stay At College (Academic Labs)",
    description: "For working late in campus academic blocks, coding labs, or hackathons.",
    requiresParent: false,
    requiresWarden: true,
    qrType: "Return Pass Only",
    tips: "Requires POC / Faculty approval first; does not require parent SMS.",
  },
  {
    code: "DIFFERENT_HOSTEL",
    name: "Staying At Different Hostel",
    description: "For staying overnight at a peer SST hostel block for study or projects.",
    requiresParent: true,
    requiresWarden: true,
    qrType: "Exit & Return Pass",
    tips: "Specify both the host student and the destination hostel building.",
  },
  {
    code: "EXAM_LEAVE",
    name: "Warden Approval for Examination / Re-exam",
    description: "For exam permits, re-examinations, or academic schedule permissions.",
    requiresParent: false,
    requiresWarden: true,
    qrType: "No QR Pass (Administrative)",
    tips: "No gate movement required. Once approved by the warden, it acts as an official record and automatically completes when the window ends.",
  },
  {
    code: "ATTENDANCE_EXCEPTION",
    name: "Warden Approval for Attendance Exception",
    description: "For hostel attendance exceptions due to academic, medical, or official college activities.",
    requiresParent: false,
    requiresWarden: true,
    qrType: "No QR Pass (Administrative)",
    tips: "Administrative leave with no physical gate movement; auto-completes when the date range concludes.",
  },
];

const WORKFLOW_STEPS = [
  {
    number: "01",
    title: "Submit Leave Request",
    desc: "Pick your leave type, specify start/end times, reason, and travel destination.",
    icon: CalendarPlus,
  },
  {
    number: "02",
    title: "Parent Approval (SMS)",
    desc: "Your parent receives an SMS with a 1-click approval link. No login required for them.",
    icon: Smartphone,
  },
  {
    number: "03",
    title: "Warden / POC Review",
    desc: "Hostel authorities verify your request and grant final administrative approval.",
    icon: ShieldCheck,
  },
  {
    number: "04",
    title: "Digital QR Pass Ready",
    desc: "Your digital pass automatically activates on your student dashboard once approved.",
    icon: QrCode,
  },
  {
    number: "05",
    title: "Gate Scan on Exit & Return",
    desc: "Security guards scan your QR at the hostel gate when you leave and when you return.",
    icon: ScanLine,
  },
];

const FAQS = [
  {
    q: "My parent hasn't received the SMS link. What should I do?",
    a: "Parent SMS messages are dispatched within ~30–50 seconds via telecom DLT routes. Verify that your parent's phone number is correct in your profile. Ask them to check their SMS inbox and spam/blocked folders. If still missing, you can view your leave details or contact the warden office to check the status.",
  },
  {
    q: "Do parents need a username and password to approve?",
    a: "No! Parents do not need to create an account or remember passwords. Each leave request sends a unique, secure one-time token link directly to their mobile number where they can review details and approve or reject in one tap.",
  },
  {
    q: "Can I extend my leave if I get delayed?",
    a: "Yes! Open your active leave from 'My leaves' and click 'Request Extension' before your scheduled return time. Never submit a new separate leave request to extend an existing leave — extensions must be tied to the current leave.",
  },
  {
    q: "Can I cancel a leave if my plans change?",
    a: "Yes, as long as you have not checked out through the security gate yet. Open the leave request and click 'Cancel Request'. Once you have scanned your QR pass at the exit gate, the leave cannot be cancelled.",
  },
  {
    q: "What does 'OVERDUE' mean?",
    a: "If you have not returned and scanned back into the hostel before your approved return timestamp, the system automatically flags your movement status as 'OVERDUE'. Wardens and security staff receive real-time notifications for overdue students.",
  },
  {
    q: "Can I leave the campus without a QR scan?",
    a: "No. Security guards must scan your QR code at the security post. Bypassing gate scans violates hostel safety policies and leaves your status marked as inside, preventing return verification.",
  },
];

export default function StudentGuidePage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <Masthead
        eyebrow="Student Handbook"
        title="How to Use SST Hostel Leave"
        description="Everything you need to know about requesting leaves, parent approvals, digital gate passes, and campus movement."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="onDark" size="sm">
              <Link href={ROUTES.STUDENT_LEAVE_NEW}>
                <CalendarPlus className="h-4 w-4" aria-hidden />
                Request leave
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
              <Link href={ROUTES.STUDENT_LEAVES}>
                <FileText className="h-4 w-4" aria-hidden />
                My leaves
              </Link>
            </Button>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-2 overflow-x-auto pb-px" aria-label="Guide sections">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-caption font-medium transition-colors",
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:border-border hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 1: OVERVIEW & WORKFLOW */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* 5-Step Process */}
          <SectionCard
            Icon={Sparkles}
            title="The 5-Step Leave Journey"
            meta="5 Steps"
          >
            <div className="grid gap-4 md:grid-cols-5">
              {WORKFLOW_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.number}
                    className="relative flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-raised"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-micro font-semibold text-accent">
                          {step.number}
                        </span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-light text-accent">
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <h3 className="mt-3 text-body font-semibold text-ink">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-caption text-muted">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Key Principles Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-raised">
              <div className="flex items-center gap-2 text-accent">
                <Smartphone className="h-5 w-5" />
                <h4 className="font-semibold text-ink">Zero Parent Passwords</h4>
              </div>
              <p className="mt-2 text-caption text-muted">
                Parents approve with one click directly from the SMS link sent to their phone. No app installation or account login is required.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-raised">
              <div className="flex items-center gap-2 text-accent">
                <QrCode className="h-5 w-5" />
                <h4 className="font-semibold text-ink">Live Digital QR Pass</h4>
              </div>
              <p className="mt-2 text-caption text-muted">
                Once approved, your QR pass becomes available on your dashboard. Security scans your pass at the hostel gate when exiting and entering.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-raised">
              <div className="flex items-center gap-2 text-accent">
                <Clock className="h-5 w-5" />
                <h4 className="font-semibold text-ink">Easy Leave Extension</h4>
              </div>
              <p className="mt-2 text-caption text-muted">
                Travel delayed? Request an extension directly on your active leave before return time instead of creating a duplicate request.
              </p>
            </div>
          </div>

          {/* Quick CTA */}
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-accent/20 bg-accent-light/30 p-6 md:flex-row">
            <div>
              <h3 className="text-h3 font-semibold text-ink">Ready to apply for a leave?</h3>
              <p className="text-caption text-muted">
                Make sure to apply well in advance so your parent and warden have time to review.
              </p>
            </div>
            <Button asChild variant="primary">
              <Link href={ROUTES.STUDENT_LEAVE_NEW}>
                Create Leave Request
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: LEAVE TYPES */}
      {activeTab === "types" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface-sunken p-4 text-caption text-muted">
            <p className="flex items-center gap-2 font-medium text-ink">
              <Info className="h-4 w-4 text-accent" />
              Different leaves follow different approval chains:
            </p>
            <p className="mt-1">
              Some leaves require parent permission first (e.g. overnight trips), while day stays in campus labs only require faculty / warden verification.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {LEAVE_TYPES_INFO.map((lt) => (
              <div
                key={lt.code}
                className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-raised"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-body font-semibold text-ink">{lt.name}</h3>
                    <span className="font-mono text-micro uppercase text-muted">
                      {lt.code}
                    </span>
                  </div>
                  <p className="mt-2 text-caption text-muted">{lt.description}</p>

                  <div className="mt-4 space-y-2 border-t border-border pt-3 text-caption">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Parent SMS Approval:</span>
                      <span className={cn("font-medium", lt.requiresParent ? "text-accent" : "text-muted")}>
                        {lt.requiresParent ? "Required" : "Not Required"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Warden Approval:</span>
                      <span className="font-medium text-accent">Required</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Gate Pass Mode:</span>
                      <span className="font-mono text-ink">{lt.qrType}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-surface-sunken p-2.5 text-micro text-muted">
                  <span className="font-semibold text-ink">Tip: </span>
                  {lt.tips}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PARENT SMS & APPROVAL */}
      {activeTab === "parent-sms" && (
        <div className="space-y-6">
          <SectionCard
            Icon={Smartphone}
            title="How Parent Approval Works"
            meta="SMS Automated"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-body font-semibold text-ink">1. Automated SMS Sent</h4>
                    <p className="text-caption text-muted">
                      As soon as you submit a leave request that requires parent approval, an SMS is sent to your registered parent contact with student details and leave dates.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-light text-success">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-body font-semibold text-ink">2. One-Tap Decision</h4>
                    <p className="text-caption text-muted">
                      Your parent opens the link in their mobile browser, reviews the destination and duration, and taps <strong>Approve</strong> or <strong>Reject</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-body font-semibold text-ink">3. Warden Receives Notification</h4>
                    <p className="text-caption text-muted">
                      Once your parent approves, the request moves to the Hostel Warden&apos;s review queue. When the warden approves, your QR pass is created.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sample SMS Preview Card */}
              <div className="rounded-xl border border-border bg-surface-sunken p-5">
                <h4 className="text-micro font-semibold uppercase tracking-wider text-muted">
                  Sample Parent SMS Preview
                </h4>
                <div className="mt-3 rounded-lg border border-border bg-surface p-4 font-mono text-caption text-ink shadow-sm">
                  <p className="text-muted">From: SST-HOSTEL</p>
                  <p className="mt-2 text-ink">
                    Dear Parent, your ward [Student Name] has requested General Leave from [Dates] for [Reason].
                  </p>
                  <p className="mt-2 text-accent underline">
                    https://leave.sst.scaler.com/parent-approve/a8b9c...
                  </p>
                  <p className="mt-2 text-micro text-muted">
                    Tap the link above to review and approve or reject this request.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2 text-micro text-muted">
                  <AlertCircle className="h-3.5 w-3.5 text-warning" />
                  Approval links expire after {PARENT_APPROVAL_TOKEN_EXPIRY_HOURS} hours if not acted upon.
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Parent Troubleshooting */}
          <div className="rounded-xl border border-warning/30 bg-warning-light/20 p-5">
            <h4 className="flex items-center gap-2 text-body font-semibold text-ink">
              <AlertTriangle className="h-4 w-4 text-warning" />
              What if my parent didn&apos;t get the SMS?
            </h4>
            <ul className="mt-2 list-inside list-disc space-y-1 text-caption text-muted">
              <li>Allow <strong>1 to 2 minutes</strong> for carrier delivery and network routing.</li>
              <li>Confirm the parent mobile number in the leave details matches their current active phone.</li>
              <li>Ask your parent to check their SMS spam/filtered folder or DND settings.</li>
              <li>If the phone number needs to be updated, contact the hostel administration desk.</li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 4: QR PASS & GATE SCANNING */}
      {activeTab === "qr-pass" && (
        <div className="space-y-6">
          <SectionCard
            Icon={QrCode}
            title="Digital QR Pass Protocol"
            meta="Gate Verification"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                  <h4 className="flex items-center gap-2 text-body font-semibold text-ink">
                    <ScanLine className="h-4 w-4 text-accent" />
                    1. When Leaving (Hostel Exit)
                  </h4>
                  <p className="mt-1 text-caption text-muted">
                    When you arrive at the security gate, open your <strong>Student Dashboard</strong> to display your active Exit QR code. The guard scans it using their scanner device.
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-micro text-success font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Status changes to: OUTSIDE_HOSTEL
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                  <h4 className="flex items-center gap-2 text-body font-semibold text-ink">
                    <ScanLine className="h-4 w-4 text-accent" />
                    2. When Returning (Hostel Entry)
                  </h4>
                  <p className="mt-1 text-caption text-muted">
                    Upon returning to campus, show your Return QR pass to the security guard before entering the hostel gates. The guard scans it to complete your movement.
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-micro text-accent font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Status changes to: INSIDE_HOSTEL (COMPLETED)
                  </div>
                </div>
              </div>

              {/* Crucial Gate Rules */}
              <div className="flex flex-col justify-between rounded-xl border border-danger/30 bg-danger-light/10 p-5">
                <div>
                  <h4 className="flex items-center gap-2 text-body font-semibold text-danger">
                    <ShieldAlert className="h-4 w-4" />
                    Essential Gate Rules
                  </h4>
                  <ul className="mt-3 space-y-2 text-caption text-ink">
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-danger">•</span>
                      <span><strong>Never bypass scanning:</strong> Leaving or entering without a guard scan will leave your record in an illegal state and can trigger disciplinary alerts.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-danger">•</span>
                      <span><strong>Do not share screenshots:</strong> QR passes are tied to your personal student credentials and refresh dynamically for security.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-danger">•</span>
                      <span><strong>Return before scheduled time:</strong> Missing your scheduled return time flags your movement as <strong>OVERDUE</strong>.</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-4 border-t border-danger/20 pt-3 text-micro text-muted">
                  Questions at the gate? Ask the security guard to check your student ID in the guard scanner console.
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* TAB 5: FAQS & RULES */}
      {activeTab === "faqs" && (
        <div className="space-y-6">
          <SectionCard
            Icon={HelpCircle}
            title="Frequently Asked Questions"
            meta="Quick Answers"
          >
            <div className="divide-y divide-border rounded-xl border border-border bg-surface">
              {FAQS.map((faq, index) => {
                const isOpen = expandedFaq === index;
                return (
                  <div key={index} className="p-4 transition-colors">
                    <button
                      onClick={() => setExpandedFaq(isOpen ? null : index)}
                      className="flex w-full items-start justify-between gap-4 text-left font-medium text-ink hover:text-accent"
                    >
                      <span>{faq.q}</span>
                      <span className="ml-2 font-mono text-body text-muted">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen && (
                      <p className="mt-3 text-caption text-muted leading-relaxed">
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Need help footer */}
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5 sm:flex-row shadow-raised">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-sunken text-accent">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-ink">Encountering an issue or system bug?</h4>
                <p className="text-caption text-muted">
                  Reach out directly to the hostel leave tech support team.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="mailto:neerasa.24bcs10005@sst.scaler.com?subject=Bug%20Report%20-%20SST%20Hostel%20Leave">
                Report a Bug
                <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
