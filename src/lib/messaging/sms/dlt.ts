// =====================================================
// INFOBIP INDIA DLT MESSAGE COMPOSITION
// src/lib/messaging/sms/dlt.ts
// =====================================================
//
// Registered DLT content template (Infobip):
//   Dear Parent,{#alp#} has applied for a Leave. Kindly click the link to review: {#urg#} -Scaler School of Technology
//
// Variables: {#alp} = student name (1st), {#urg#} = approval link (2nd).
//
// Fixed text: 100 chars. The full message excluding the approval link must
// total 130 chars (100 fixed + up to 30 for the student name), so the link
// (shortened to ~23-35 chars by Infobip at send time) keeps the SMS within
// 160 chars.

export const DLT_FIXED_TEXT_LENGTH = 100;

export const DLT_MAX_NAME_LENGTH = 30;

/**
 * Builds the name to substitute into the DLT parent-approval SMS.
 * Prefers the full name, falls back to the first name, and truncates
 * as a last resort so the message stays within the 160-char SMS budget.
 */
export function buildParentApprovalDltName(studentName: string): string {
  const trimmed = studentName.trim();

  if (trimmed.length <= DLT_MAX_NAME_LENGTH) {
    return trimmed;
  }

  const firstName = trimmed.split(/\s+/)[0] ?? "";

  if (firstName.length <= DLT_MAX_NAME_LENGTH) {
    return firstName;
  }

  return firstName.slice(0, DLT_MAX_NAME_LENGTH);
}
