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

/**
 * The swatches an admin can assign to a leave type.
 *
 * A leave type's colour is stored data — the admin picks it and it renders in
 * badges and charts — so it cannot be a CSS custom property. But it should
 * still be *of* the system: these are the design system's own hues at their
 * light-theme values, not an arbitrary rainbow.
 *
 * Kept deliberately short. The previous palette offered twenty-four choices,
 * which guarantees any list of leave types reads as a wall of colour and
 * buries the status the reader is actually scanning for.
 */
export const LEAVE_TYPE_COLOR_PALETTE = [
  "#0E4EB7", // accent — Scaler Blue
  "#0F7A3D", // success
  "#8A5200", // warning
  "#C3221C", // danger
  "#0B1F42", // navy
  "#59637A", // muted
] as const;
