import {
  AlertTriangle,
  Ban,
  CalendarX,
  Check,
  Clock,
  PackageCheck,
  ScanLine,
  UserCheck,
  X,
  Zap,
} from "lucide-react";

import type { StatusPresentation } from "@/design-system/sst";
import { StatusBadge as SstStatusBadge } from "@/design-system/sst";

/**
 * The lowercase status vocabulary the screens speak, mapped onto the closed
 * taxonomy. Each entry carries an icon and a written label, so a status is
 * never colour alone — greyscale the screen and the meaning survives.
 */
const PRESENTATION = {
  approved: { tone: "success", label: "Approved", Icon: Check },
  pending: { tone: "warning", label: "Awaiting approval", Icon: Clock },
  rejected: { tone: "danger", label: "Rejected", Icon: X },
  active: { tone: "accent", label: "Active", Icon: ScanLine },
  cancelled: { tone: "neutral", label: "Cancelled", Icon: X },
  expired: { tone: "neutral", label: "Expired", Icon: CalendarX },
  overdue: { tone: "danger", label: "Overdue", Icon: AlertTriangle },
  completed: { tone: "neutral", label: "Completed", Icon: PackageCheck },
  auto_approved: { tone: "success", label: "Auto-approved", Icon: Zap },
  parent_approval: {
    tone: "accent",
    label: "With parent",
    Icon: UserCheck,
  },
  no_show: { tone: "danger", label: "No-show", Icon: Ban },
} as const satisfies Record<string, StatusPresentation>;

export type Status = keyof typeof PRESENTATION;

type StatusBadgeProps = {
  status: Status;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <SstStatusBadge status={PRESENTATION[status]} className={className} />
  );
}
