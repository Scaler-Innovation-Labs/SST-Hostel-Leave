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

export const CATEGORY_COLORS: Record<string, string> = {
  HOME_PASS: "bg-violet-100 text-violet-800",
  MEDICAL: "bg-rose-100 text-rose-800",
  LOCAL_OUTING: "bg-sky-100 text-sky-800",
  NIGHT_OUT: "bg-indigo-100 text-indigo-800",
  ACADEMIC: "bg-amber-100 text-amber-800",
  HOSTEL: "bg-teal-100 text-teal-800",
};
