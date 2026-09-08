/**
 * Canonical phone-number handling (single source of truth).
 *
 * Every phone field in the app — DTOs, bulk-import validation, client
 * forms — funnels through here. SMS delivery requires a reachable Indian
 * mobile, so anything else is rejected at the boundary instead of failing
 * silently at the provider (e.g. an 11-digit typo stored verbatim, then
 * rejected by the operator after the app already logged SENT).
 */

/** 10 digits, first digit 6-9 (Indian mobile range). */
export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

export const PHONE_VALIDATION_MESSAGE =
  "Enter a valid 10-digit mobile number";

/**
 * Canonicalize free-form input: strip separators, drop an explicit
 * country/trunk prefix (`+91`, `91`, or leading `0`). Returns digits only;
 * may still be invalid — always pair with {@link isValidPhoneNumber}.
 */
export function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** True when the value is a dialable Indian mobile after normalization. */
export function isValidPhoneNumber(value: string): boolean {
  return INDIAN_MOBILE_PATTERN.test(normalizePhoneNumber(value));
}
