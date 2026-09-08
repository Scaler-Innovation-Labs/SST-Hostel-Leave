import { z } from "zod";

import {
  INDIAN_MOBILE_PATTERN,
  normalizePhoneNumber,
  PHONE_VALIDATION_MESSAGE,
} from "@/utils/phone";

// Shared phone fields: values are normalized (separators and +91/0 trunk
// prefixes stripped) so every write path stores the canonical 10 digits,
// then validated as an Indian mobile. Normalization first means inputs
// like "+91 98765 43210" and "09876543210" are accepted and stored clean.

export function requiredPhoneField() {
  return z
    .string()
    .max(20)
    .transform((value) => normalizePhoneNumber(value))
    .refine((value) => INDIAN_MOBILE_PATTERN.test(value), {
      message: PHONE_VALIDATION_MESSAGE,
    });
}

export function optionalPhoneField() {
  return z
    .string()
    .max(20)
    .optional()
    .transform((value) => (value === undefined ? value : normalizePhoneNumber(value)))
    .refine((value) => value === undefined || INDIAN_MOBILE_PATTERN.test(value), {
      message: PHONE_VALIDATION_MESSAGE,
    });
}

export function optionalBlankPhoneField() {
  return z
    .string()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === undefined ? value : normalizePhoneNumber(value)))
    .refine((value) => value === undefined || value === "" || INDIAN_MOBILE_PATTERN.test(value), {
      message: PHONE_VALIDATION_MESSAGE,
    });
}
