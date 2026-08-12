import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS, type LeaveRequestStatus } from "@/constants/leave/leave-status";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveApprovalAnalyticsRepository } from "@/db/repositories/leave/leave-approval-analytics.repository";
import { movementEventRepository } from "@/db/repositories/movement/movement-event.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import type { Activity, ApprovalStep, DashboardStats, StaffDashboardStats, StudentDashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import { getScopedHostelIds, isStaffScopeRestricted } from "@/services/shared/authorization.service";

function fillDateRange(startDate: Date, endDate: Date, data: Array<{ date: string; count: number }>): Array<{ date: string; value: number }> {
  const map = new Map(data.map((d) => [d.date, d.count]));
  const result: Array<{ date: string; value: number }> = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({ date: dateStr, value: map.get(dateStr) ?? 0 });
    current.setDate(current.getDate() + 1);
  }
  return result;
}

export async function getDashboardStats(
  currentUser: CurrentUser,
  status?: LeaveRequestStatus
): Promise<DashboardStats> {
  const isStudent = currentUser.roles.includes(ROLES.STUDENT);

  if (isStudent) {
    return getStudentStats(currentUser.id);
  }

  return getStaffStats(currentUser, status);
}

const STEP_LABELS: Record<string, string> = {
  PARENT_APPROVAL: "Parent",
  POC_APPROVAL: "POC",
  ADMIN_APPROVAL: "Admin",
  AUTO_APPROVAL: "Auto",
  NOTIFICATION: "Notification",
  QR_EXIT: "QR Exit",
  QR_RETURN: "QR Return",
  COMPLETE: "Complete",
};

const ACTIVITY_LABELS: Record<string, string> = {
  LEAVE_APPROVED: "Leave approved",
  EXIT_HOSTEL: "Left hostel",
  ENTER_HOSTEL: "Returned to hostel",
  AUTO_OVERDUE: "Marked overdue",
  MANUAL_RETURN: "Manual return",
  MANUAL_CHECKOUT: "Manual checkout",
  SECURITY_OVERRIDE: "Security override",
  QR_INVALIDATED: "QR invalidated",
  LEAVE_SUBMITTED: "Leave submitted",
  LEAVE_REJECTED: "Leave rejected",
  LEAVE_CANCELLED: "Leave cancelled",
  LEAVE_COMPLETED: "Leave completed",
  QR_GENERATED: "QR generated",
};

async function getStudentStats(userId: string): Promise<StudentDashboardStats> {
  const student = await studentRepository.findByUserId(userId);

  if (!student) {
    throw new NotFoundError("Student");
  }

  const [pendingLeavesResult, approvedLeavesResult] = await Promise.all([
    leaveRepository.findByFilters({
      studentId: student.id,
      status: LEAVE_REQUEST_STATUS.PENDING,
      page: 1,
      limit: 1,
    }),
    leaveRepository.findByFilters({
      studentId: student.id,
      status: LEAVE_REQUEST_STATUS.APPROVED,
      page: 1,
      limit: 100,
    }),
  ]);

  const activeLeave = approvedLeavesResult.items[0] ?? null;
  const pendingLeave = pendingLeavesResult.items[0] ?? null;

  const latestMovement = await movementEventRepository.findLatestByStudentId(student.id);

  const qrPassesList = await qrPassRepository.findByStudentId(student.id);
  const activeQr = qrPassesList.find(
    (q) => q.status === "ACTIVE" && (!q.expiresAt || q.expiresAt > new Date())
  ) ?? null;

  const targetLeave = activeLeave ?? pendingLeave;
  const approvalProgress: ApprovalStep[] | null = targetLeave
    ? await loadApprovalProgress(targetLeave.leave.id)
    : null;

  const [recentMovements] = await Promise.all([
    movementEventRepository.findByFilters({
      studentId: student.id,
      page: 1,
      limit: 5,
    }),
  ]);

  const recentActivity: Activity[] = recentMovements.items.map((m) => ({
    type: m.eventType,
    description: ACTIVITY_LABELS[m.eventType] ?? m.eventType.toLowerCase().replace(/_/g, " "),
    timestamp: m.occurredAt.toISOString(),
  }));

  return {
    pendingLeaves: pendingLeavesResult.total,
    approvedLeaves: approvedLeavesResult.total,
    activeLeave: activeLeave
      ? {
          id: activeLeave.leave.id,
          leaveType: activeLeave.leaveType?.name ?? "Unknown",
          startAt: activeLeave.leave.startAt.toISOString(),
          endAt: activeLeave.leave.endAt.toISOString(),
          status: activeLeave.leave.status,
        }
      : null,
    currentLocation: latestMovement?.toState ?? student.currentLocationState ?? "UNKNOWN",
    activeQr: activeQr
      ? {
          passId: activeQr.id,
          token: activeQr.tokenHash.slice(0, 8) + "...",
          expiresAt: activeQr.expiresAt?.toISOString() ?? "",
        }
      : null,
    approvalProgress,
    recentActivity,
  };
}

async function loadApprovalProgress(leaveRequestId: string): Promise<ApprovalStep[]> {
  const approvals = await leaveApprovalRepository.findByLeaveRequestId(leaveRequestId);
  return approvals.map((a) => ({
    stepKey: a.stepKey,
    stepOrder: a.stepOrder,
    decision: a.decision,
    label: STEP_LABELS[a.stepKey] ?? a.stepKey.toLowerCase().replace(/_/g, " "),
    actedAt: a.actedAt?.toISOString() ?? null,
  }));
}

async function getStaffStats(
  currentUser: CurrentUser,
  status?: LeaveRequestStatus
): Promise<StaffDashboardStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // HOSTEL-scoped staff see only stats for their hostels; no scopes = ALL.
  const hostelIds =
    isStaffScopeRestricted(currentUser) ? getScopedHostelIds(currentUser) : undefined;

  const [
    pendingApprovalsCount,
    pendingExtensionsCount,
    totalStudentsCount,
    activeStudentsCount,
    studentsOnLeaveCount,
    overdueStudentsCount,
    totalUsers,
    totalLeavesCount,
    approvedLeavesCount,
    recentApprovalsCount,
    leaveTypeBreakdown,
    rejectedLeaves,
    averageApprovalTime,
    activeQrCount,
    movementEventCount,
    leaves7dRaw,
    leaves30dRaw,
    approvals7dRaw,
  ] = await Promise.all([
    leaveApprovalAnalyticsRepository.countPendingByType(LEAVE_APPROVAL_DECISION.PENDING, { hostelIds }),
    leaveApprovalAnalyticsRepository.countPendingByType(LEAVE_APPROVAL_DECISION.PENDING, { extensionOnly: true, hostelIds }),
    studentRepository.countAll(hostelIds),
    studentRepository.countByLocationState(MOVEMENT_STATE.IN_HOSTEL, hostelIds),
    studentRepository.countByLocationState(MOVEMENT_STATE.OUTSIDE_HOSTEL, hostelIds),
    studentRepository.countByLocationState(MOVEMENT_STATE.OVERDUE, hostelIds),
    userRepository.count(hostelIds),
    leaveRepository.countAll(hostelIds),
    leaveRepository.countByStatus(LEAVE_REQUEST_STATUS.APPROVED, hostelIds),
    leaveApprovalAnalyticsRepository.countRecent(sevenDaysAgo, hostelIds),
    leaveRepository.countByLeaveType(hostelIds, status),
    leaveRepository.countByStatus(LEAVE_REQUEST_STATUS.REJECTED, hostelIds),
    leaveApprovalAnalyticsRepository.averageApprovalTime(thirtyDaysAgo, hostelIds),
    qrPassRepository.countActive(hostelIds),
    movementEventRepository.countRecent(sevenDaysAgo, hostelIds),
    leaveRepository.countByDateRange(sevenDaysAgo, now, status, hostelIds),
    leaveRepository.countByDateRange(thirtyDaysAgo, now, status, hostelIds),
    leaveApprovalAnalyticsRepository.countByDateRange(sevenDaysAgo, now, hostelIds),
  ]);

  return {
    totalStudents: totalStudentsCount,
    activeStudents: activeStudentsCount,
    studentsOnLeave: studentsOnLeaveCount,
    pendingApprovals: pendingApprovalsCount,
    pendingExtensions: pendingExtensionsCount,
    overdueStudents: overdueStudentsCount,
    studentsOutside: studentsOnLeaveCount,
    totalUsers,
    totalLeaves: totalLeavesCount,
    approvedLeaves: approvedLeavesCount,
    rejectedLeaves,
    recentApprovalsCount,
    averageApprovalHours: averageApprovalTime,
    activeQrPasses: activeQrCount,
    movementEvents: movementEventCount,
    leaveTypeBreakdown,
    leavesLast7Days: fillDateRange(sevenDaysAgo, now, leaves7dRaw),
    leavesLast30Days: fillDateRange(thirtyDaysAgo, now, leaves30dRaw),
    approvalsLast7Days: fillDateRange(sevenDaysAgo, now, approvals7dRaw),
  };
}
