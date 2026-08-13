/**
 * Maps (leave type, rejection source) to the rejection email template code.
 *
 * Rejections are dispatched with an explicit templateCode (never via the
 * rules/fallback path) because the right message depends on WHO rejected:
 * the parent, the hostel admin, or a policy check. The policy variant is
 * handled at submission time in create-leave.service; admin/parent variants
 * are resolved here from the outbox payload's `rejectedBy` field.
 */
const REJECTION_TEMPLATE_CODES: Record<
  string,
  { PARENT?: string; ADMIN?: string }
> = {
  RE_EXAM: {
    PARENT: "leave_rejected_email_re_exam_parent",
    ADMIN: "leave_rejected_email_re_exam_admin",
  },
  LONG_LEAVE: {
    PARENT: "leave_rejected_email_long_leave_parent",
    ADMIN: "leave_rejected_email_long_leave_admin",
  },
  LATE_ENTRY: {
    PARENT: "leave_rejected_email_late_entry_parent",
    ADMIN: "leave_rejected_email_late_entry_admin",
  },
  LATE_STAY_COLLEGE: {
    ADMIN: "leave_rejected_email_late_stay_admin",
  },
  DIFFERENT_HOSTEL: {
    PARENT: "leave_rejected_email_diff_hostel_parent",
    ADMIN: "leave_rejected_email_diff_hostel_admin",
  },
  HOLIDAY: {
    ADMIN: "leave_rejected_email_holiday_admin",
  },
  INTERNSHIP: {
    PARENT: "leave_rejected_email_internship_parent",
    ADMIN: "leave_rejected_email_internship_admin",
  },
  MARRIAGE_BEREAVEMENT: {
    PARENT: "leave_rejected_email_marriage_parent",
    ADMIN: "leave_rejected_email_marriage_admin",
  },
};

export function getRejectionTemplateCode(
  leaveTypeCode: string,
  rejectedBy: "PARENT" | "ADMIN"
): string | null {
  return REJECTION_TEMPLATE_CODES[leaveTypeCode]?.[rejectedBy] ?? null;
}
