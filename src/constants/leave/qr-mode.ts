export const QR_MODES = [
  "NONE",
  "EXIT_ONLY",
  "RETURN_ONLY",
  "BOTH",
  "OPTIONAL",
  "DAILY_RECURRING",
] as const;

export type QrMode = (typeof QR_MODES)[number];

export const QR_MODE = {
  NONE: "NONE",
  EXIT_ONLY: "EXIT_ONLY",
  RETURN_ONLY: "RETURN_ONLY",
  BOTH: "BOTH",
  OPTIONAL: "OPTIONAL",
  DAILY_RECURRING: "DAILY_RECURRING",
} as const;
