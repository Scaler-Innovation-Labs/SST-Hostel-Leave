// =====================================================
// QR USABILITY WINDOW
// src/constants/movement/qr-window.ts
// =====================================================
//
// Contract (docs/movement-contract.md §2): a QR pass is usable only inside
// [valid_from, expires_at]. valid_from = leave startAt; expires_at = leave
// endAt + RETURN_GRACE_MS. The grace keeps the pass scannable for a short
// window after the leave ends (e.g. a student scanning out right at the end);
// an overdue student's RETURN scan ignores this bound — only the exit scan is
// gated by the window.

export const QR_RETURN_GRACE_MS = 24 * 60 * 60 * 1000;

export function getQrExpiryFromLeaveEnd(endAt: Date): Date {
  return new Date(endAt.getTime() + QR_RETURN_GRACE_MS);
}
