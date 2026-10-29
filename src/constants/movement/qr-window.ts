import { endOfDayIst, startOfDayIst } from "@/lib/date-utils";

// =====================================================
// QR USABILITY WINDOW
// src/constants/movement/qr-window.ts
// =====================================================
//
// Contract:
// - A QR pass exit scan is allowed from the departure date till the day before the return date.
//   For same-day leaves, exit is allowed through the end of that day.
// - A QR pass return scan is valid from the leave date through the return date (23:59:59.999 IST).
//   After the return date, the pass expires and overdue returns are handled via manual movement.

export const QR_RETURN_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Calculates the last instant (in IST) that a QR pass can be used for EXIT.
 * "from that day till the day before return date":
 * - Leaving date is startAt.
 * - Return date is endAt.
 * - If endAt is after startAt (multi-day leave): exit is allowed through the end
 *   of the day BEFORE return date (23:59:59.999 IST of the day before endAt).
 * - If endAt is on the same day as startAt (same-day leave): exit is allowed through
 *   the end of that day (23:59:59.999 IST of startAt).
 */
export function getQrExitExpiry(startAt: Date, endAt: Date): Date {
  const startDay = startOfDayIst(startAt);
  const endDay = startOfDayIst(endAt);

  if (endDay.getTime() <= startDay.getTime()) {
    // Same-day leave: exit allowed through the end of that day in IST
    return endOfDayIst(startAt);
  }

  // Multi-day leave: exit allowed till the day before the return date (23:59:59.999 IST)
  return new Date(endDay.getTime() - 1);
}

/**
 * Calculates the last instant (in IST) that a QR pass can be used for RETURN.
 * "return scan is also valid from leave date to return date":
 * Return scan is valid through the end of the return date in IST (23:59:59.999 IST of endAt).
 */
export function getQrReturnExpiry(endAt: Date): Date {
  return endOfDayIst(endAt);
}

export function getQrExpiryFromLeaveEnd(endAt: Date, startAt?: Date): Date {
  if (startAt) {
    return getQrExitExpiry(startAt, endAt);
  }
  return new Date(endAt.getTime() + QR_RETURN_GRACE_MS);
}
