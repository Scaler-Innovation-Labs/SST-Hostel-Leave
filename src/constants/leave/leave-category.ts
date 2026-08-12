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
  HOME_PASS: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  MEDICAL: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  LOCAL_OUTING: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  NIGHT_OUT: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  ACADEMIC: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  HOSTEL: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
};

export const LEAVE_TYPE_COLOR_PALETTE = [
  "#4f46e5", // indigo-600
  "#2563eb", // blue-600
  "#0284c7", // sky-600
  "#0891b2", // cyan-600
  "#0d9488", // teal-600
  "#ea580c", // orange-600
  "#c026d3", // fuchsia-600
  "#db2777", // pink-600
  "#7c3aed", // violet-600
  "#78716c", // stone-500
  "#dc2626", // red-600
  "#16a34a", // green-600
  "#ca8a04", // yellow-600
  "#0f766e", // teal-700
  "#e11d48", // rose-600
  "#65a30d", // lime-600
  "#d97706", // amber-600
  "#64748b", // slate-500
  "#0ea5e9", // sky-500
  "#10b981", // emerald-500
  "#ef4444", // red-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
] as const;
