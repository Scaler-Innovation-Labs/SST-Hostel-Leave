import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { movementEventRepository } from "@/db/repositories/movement/movement-event.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import type { DashboardStats,StaffDashboardStats, StudentDashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";

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

export async function getDashboardStats(currentUser: CurrentUser): Promise<DashboardStats> {
  const isStudent = currentUser.roles.includes(ROLES.STUDENT);

  if (isStudent) {
    return getStudentStats(currentUser.id);
  }

  return getStaffStats();
}

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

  const latestMovement = await movementEventRepository.findLatestByStudentId(student.id);

  const qrPassesList = await qrPassRepository.findByStudentId(student.id);
  const activeQr = qrPassesList.find(
    (q) => q.status === "ACTIVE" && (!q.expiresAt || q.expiresAt > new Date())
  ) ?? null;

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
  };
}

async function getStaffStats(): Promise<StaffDashboardStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    pendingApprovalsCount,
    activeStudentsCount,
    studentsOutsideCount,
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
    leaveApprovalRepository.countByDecision(LEAVE_APPROVAL_DECISION.PENDING),
    studentRepository.countAll(),
    studentRepository.countByLocationState(MOVEMENT_STATE.OUTSIDE_HOSTEL),
    studentRepository.countByLocationState(MOVEMENT_STATE.OVERDUE),
    userRepository.count(),
    leaveRepository.countAll(),
    leaveRepository.countByStatus(LEAVE_REQUEST_STATUS.APPROVED),
    leaveApprovalRepository.countRecent(sevenDaysAgo),
    leaveRepository.countByLeaveType(),
    leaveRepository.countByStatus(LEAVE_REQUEST_STATUS.REJECTED),
    leaveApprovalRepository.averageApprovalTime(thirtyDaysAgo),
    qrPassRepository.countActive(),
    movementEventRepository.countRecent(sevenDaysAgo),
    leaveRepository.countByDateRange(sevenDaysAgo, now),
    leaveRepository.countByDateRange(thirtyDaysAgo, now),
    leaveApprovalRepository.countByDateRange(sevenDaysAgo, now),
  ]);

  return {
    pendingApprovals: pendingApprovalsCount,
    activeStudents: activeStudentsCount,
    studentsOutside: studentsOutsideCount,
    overdueStudents: overdueStudentsCount,
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
