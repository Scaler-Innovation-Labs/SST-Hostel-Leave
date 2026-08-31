import {
  AlertTriangle,
  Ban,
  Building2,
  CalendarX,
  Check,
  Clock,
  LogOut,
  PackageCheck,
  QrCode,
  ScanLine,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import type React from "react";

import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import type { LeaveRequestStatus } from "@/constants/leave/leave-status";
import type { MovementState } from "@/constants/movement/movement-state";
import type { QrStatus } from "@/constants/movement/qr-status";

import type { BadgeTone } from "./Badge";

/**
 * The status taxonomies are closed and typed.
 *
 * Every entry carries an icon and a label alongside its tone, so a status can
 * never be rendered as colour alone — the "colour is never the sole signal"
 * rule is enforced by the type system rather than by review. Any new status
 * value fails to compile until it is given a presentation here.
 */
export type StatusPresentation = {
  tone: BadgeTone;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

/**
 * A leave request is permission, not movement. `COMPLETED` means the student
 * is back and the permission is spent — a quiet terminal state, not a
 * celebration, so it stays neutral.
 */
export const LEAVE_STATUS_PRESENTATION: Record<
  LeaveRequestStatus,
  StatusPresentation
> = {
  PENDING: { tone: "warning", label: "Awaiting approval", Icon: Clock },
  APPROVED: { tone: "success", label: "Approved", Icon: Check },
  REJECTED: { tone: "danger", label: "Rejected", Icon: X },
  CANCELLED: { tone: "neutral", label: "Cancelled", Icon: X },
  EXPIRED: { tone: "neutral", label: "Expired", Icon: CalendarX },
  OVERDUE: { tone: "danger", label: "Overdue", Icon: AlertTriangle },
  COMPLETED: { tone: "neutral", label: "Completed", Icon: PackageCheck },
};

export const APPROVAL_DECISION_PRESENTATION: Record<
  LeaveApprovalDecision,
  StatusPresentation
> = {
  PENDING: { tone: "warning", label: "Awaiting decision", Icon: Clock },
  APPROVED: { tone: "success", label: "Approved", Icon: Check },
  AUTO_APPROVED: { tone: "success", label: "Auto-approved", Icon: Zap },
  REJECTED: { tone: "danger", label: "Rejected", Icon: X },
  CANCELLED: { tone: "neutral", label: "Cancelled", Icon: X },
};

/** Movement is reality: where the student physically is right now. */
export const MOVEMENT_STATE_PRESENTATION: Record<
  MovementState,
  StatusPresentation
> = {
  IN_HOSTEL: { tone: "success", label: "In hostel", Icon: Building2 },
  APPROVED_LEAVE: {
    tone: "accent",
    label: "Cleared to leave",
    Icon: ShieldCheck,
  },
  CHECKED_OUT: { tone: "info", label: "Checked out", Icon: ScanLine },
  OUTSIDE_HOSTEL: { tone: "info", label: "Outside hostel", Icon: LogOut },
  OVERDUE: { tone: "danger", label: "Overdue", Icon: AlertTriangle },
};

export const QR_STATUS_PRESENTATION: Record<QrStatus, StatusPresentation> = {
  ACTIVE: { tone: "success", label: "Active", Icon: QrCode },
  USED: { tone: "neutral", label: "Used", Icon: Check },
  EXPIRED: { tone: "neutral", label: "Expired", Icon: Clock },
  INVALIDATED: { tone: "danger", label: "Invalidated", Icon: Ban },
};
