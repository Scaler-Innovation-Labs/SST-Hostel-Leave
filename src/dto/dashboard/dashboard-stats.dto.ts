export type StudentDashboardStats = {
  pendingLeaves: number;
  approvedLeaves: number;
  activeLeave: {
    id: string;
    leaveType: string;
    startAt: string;
    endAt: string;
    status: string;
  } | null;
  currentLocation: string;
  activeQr: {
    passId: string;
    token: string;
    expiresAt: string;
  } | null;
};

export type TimeSeriesPoint = {
  date: string;
  value: number;
};

export type StaffDashboardStats = {
  pendingApprovals: number;
  activeStudents: number;
  studentsOutside: number;
  overdueStudents: number;
  totalUsers: number;
  totalLeaves: number;
  approvedLeaves: number;
  rejectedLeaves: number;
  recentApprovalsCount: number;
  averageApprovalHours: number | null;
  activeQrPasses: number;
  movementEvents: number;
  leaveTypeBreakdown: Array<{
    name: string;
    count: number;
  }>;
  leavesLast7Days: TimeSeriesPoint[];
  leavesLast30Days: TimeSeriesPoint[];
  approvalsLast7Days: TimeSeriesPoint[];
};

export type DashboardStats = StudentDashboardStats | StaffDashboardStats;
