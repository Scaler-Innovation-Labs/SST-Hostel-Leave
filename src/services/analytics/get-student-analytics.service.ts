import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { studentAnalyticsRepository } from "@/db/repositories/student/student-analytics.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import type { AnalyticsPeriod, StudentAnalytics } from "@/dto/analytics/student-analytics.dto";
import { fillDateRange } from "@/lib/analytics/trend";
import type { CurrentUser } from "@/lib/auth/types";
import {
  getAnalyticsHostelScope,
  resolveAnalyticsRange,
} from "@/services/analytics/analytics-scope.service";

export async function getStudentAnalytics(
  currentUser: CurrentUser,
  period: AnalyticsPeriod = "30d"
): Promise<StudentAnalytics> {
  const hostelIds = getAnalyticsHostelScope(currentUser);
  const { startDate, endDate, isBounded } = resolveAnalyticsRange(period);

  const [totalUsers, totalStudents, inHostel, onLeave, overdue, byHostel, byDepartment, byAcademicGroup, byGender, trend] =
    await Promise.all([
      userRepository.count(hostelIds),
      studentRepository.countAll(hostelIds),
      studentRepository.countByLocationState(MOVEMENT_STATE.IN_HOSTEL, hostelIds),
      studentRepository.countByLocationState(MOVEMENT_STATE.OUTSIDE_HOSTEL, hostelIds),
      studentRepository.countByLocationState(MOVEMENT_STATE.OVERDUE, hostelIds),
      studentAnalyticsRepository.countByHostel(hostelIds),
      studentAnalyticsRepository.countByDepartment(hostelIds),
      studentAnalyticsRepository.countByAcademicGroup(hostelIds),
      studentAnalyticsRepository.countByGender(hostelIds),
      studentAnalyticsRepository.trendByDateRange(startDate, endDate, hostelIds),
    ]);

  return {
    period,
    totalUsers,
    totalStudents,
    inHostel,
    onLeave,
    overdue,
    byHostel,
    byDepartment,
    byAcademicGroup,
    byGender,
    trend: isBounded ? fillDateRange(startDate, endDate, trend) : trend.map((row) => ({ date: row.date, value: row.count })),
  };
}