export const LEAVE_CATEGORIES = [
  "HOME_PASS",
  "MEDICAL",
  "LOCAL_OUTING",
  "NIGHT_OUT",
  "ACADEMIC",
  "HOSTEL",
] as const;

export type LeaveCategory = (typeof LEAVE_CATEGORIES)[number];

export const LEAVE_CATEGORY = {
  HOME_PASS: "HOME_PASS",
  MEDICAL: "MEDICAL",
  LOCAL_OUTING: "LOCAL_OUTING",
  NIGHT_OUT: "NIGHT_OUT",
  ACADEMIC: "ACADEMIC",
  HOSTEL: "HOSTEL",
} as const;
