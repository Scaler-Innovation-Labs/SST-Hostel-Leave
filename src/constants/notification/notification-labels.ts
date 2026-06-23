export const EVENT_LABELS: Record<string, string> = {
  LEAVE_SUBMITTED: "Leave Submitted",
  LEAVE_APPROVED: "Leave Approved",
  LEAVE_REJECTED: "Leave Rejected",
  LEAVE_CANCELLED: "Leave Cancelled",
  LEAVE_COMPLETED: "Leave Completed",
  LEAVE_EXPIRED: "Leave Expired",
  LEAVE_EXTENSION_REQUESTED: "Extension Requested",
  LEAVE_EXTENSION_APPROVED: "Extension Approved",
  LEAVE_EXTENSION_REJECTED: "Extension Rejected",
  LEAVE_OVERDUE: "Leave Overdue",
  PARENT_APPROVAL_REQUESTED: "Parent Approval Requested",
  QR_GENERATED: "QR Generated",
  QR_INVALIDATED: "QR Invalidated",
};

export const EVENT_COLORS: Record<string, string> = {
  LEAVE_SUBMITTED: "bg-blue-500/10 text-blue-600",
  LEAVE_APPROVED: "bg-emerald-500/10 text-emerald-600",
  LEAVE_REJECTED: "bg-destructive/10 text-destructive",
  LEAVE_CANCELLED: "bg-muted text-muted-foreground",
  LEAVE_COMPLETED: "bg-emerald-500/10 text-emerald-600",
  LEAVE_EXPIRED: "bg-amber-500/10 text-amber-600",
  LEAVE_OVERDUE: "bg-destructive/10 text-destructive",
  LEAVE_EXTENSION_REQUESTED: "bg-blue-500/10 text-blue-600",
  LEAVE_EXTENSION_APPROVED: "bg-emerald-500/10 text-emerald-600",
  LEAVE_EXTENSION_REJECTED: "bg-destructive/10 text-destructive",
  PARENT_APPROVAL_REQUESTED: "bg-violet-500/10 text-violet-600",
  QR_GENERATED: "bg-primary/10 text-primary",
  QR_INVALIDATED: "bg-amber-500/10 text-amber-600",
};

export function getEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.replace(/_/g, " ").toLowerCase();
}

export function getEventColor(eventType: string): string {
  return EVENT_COLORS[eventType] ?? "bg-muted text-muted-foreground";
}
