import {
  Briefcase,
  Building2,
  Calendar,
  GraduationCap,
  Heart,
  Home,
  MapPin,
  Moon,
} from "lucide-react";
import type React from "react";

import { LEAVE_CATEGORY, type LeaveCategory } from "./leave-category";

/**
 * How a leave type is drawn.
 *
 * Leave types are configured in the database, not enumerated in code, so the
 * icon is matched from the type's name. This lived inline in four screens with
 * three different colour vocabularies between them; it lives here once so a
 * medical leave looks the same wherever it appears.
 *
 * Tone is deliberately absent: per the colour rule a leave type is not a
 * status, so its tile carries the accent wash and the *status badge* carries
 * the meaning. Ten saturated leave-type colours on one list is a wall of
 * colour that buries the thing the reader is actually scanning for.
 */
type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

/** Ordered: the first keyword that matches a type's name wins. */
const NAME_TO_ICON: ReadonlyArray<readonly [readonly string[], IconComponent]> = [
  [["MEDICAL", "HEALTH", "SICK"], Heart],
  [["EXAM", "STUDY", "ACADEM", "EDUCATION"], GraduationCap],
  [["INTERN", "JOB", "PROFESSIONAL", "PLACEMENT"], Briefcase],
  [["NIGHT", "OVERNIGHT", "STAY"], Moon],
  [["HOME", "PASS"], Home],
  [["HOSTEL", "CAMPUS", "DORM"], Building2],
  [["CASUAL", "LOCAL", "OUTING", "PERSONAL", "GENERAL"], MapPin],
] as const;

export function leaveTypeIcon(leaveTypeName: string | null | undefined): IconComponent {
  const name = (leaveTypeName ?? "").toUpperCase();
  for (const [keywords, Icon] of NAME_TO_ICON) {
    if (keywords.some((keyword) => name.includes(keyword))) return Icon;
  }
  return Calendar;
}

/** The fixed category enum, which does have a stable icon per value. */
export const LEAVE_CATEGORY_PRESENTATION: Record<
  LeaveCategory,
  { label: string; Icon: IconComponent }
> = {
  [LEAVE_CATEGORY.HOME_PASS]: { label: "Home pass", Icon: Home },
  [LEAVE_CATEGORY.MEDICAL]: { label: "Medical", Icon: Heart },
  [LEAVE_CATEGORY.LOCAL_OUTING]: { label: "Local outing", Icon: MapPin },
  [LEAVE_CATEGORY.NIGHT_OUT]: { label: "Night out", Icon: Moon },
  [LEAVE_CATEGORY.ACADEMIC]: { label: "Academic", Icon: GraduationCap },
  [LEAVE_CATEGORY.HOSTEL]: { label: "Hostel", Icon: Building2 },
};
