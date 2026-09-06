import { z } from "zod";

// Bounds: requestedEndAt must parse as a date (garbage strings otherwise
// become Invalid Date, which silently passes the `> endAt` comparison and
// fails later as a 500). A full `z.string().datetime()` would reject the
// `datetime-local` values the ExtensionForm validates client-side before
// converting to ISO, so the contract is "parseable date" here and the
// service enforces `> current end` after parsing.
function isParsableDate(value: string): boolean {
  return value.trim().length > 0 && !Number.isNaN(new Date(value).getTime());
}

// submittedForm is stored verbatim (unlike leave creation, extensions don't
// re-validate against the form schema), so key count, key shape, and
// serialized size are capped here instead — values still flow through
// escaped notification rendering only.
const MAX_EXTENSION_FORM_KEYS = 50;
const MAX_EXTENSION_FORM_BYTES = 20_000;

export const createExtensionSchema = z.object({
  requestedEndAt: z
    .string()
    .min(1, "New end date is required")
    .refine(isParsableDate, "New end date must be a valid date"),
  reason: z.string().min(1, "Reason is required").max(1000),
  submittedForm: z
    .record(z.string().min(1).max(100), z.unknown())
    .refine((form) => Object.keys(form).length <= MAX_EXTENSION_FORM_KEYS, {
      message: `submittedForm must have at most ${MAX_EXTENSION_FORM_KEYS} fields`,
    })
    .refine((form) => JSON.stringify(form).length <= MAX_EXTENSION_FORM_BYTES, {
      message: "submittedForm is too large",
    })
    .optional(),
});

export type CreateExtensionDto = z.infer<typeof createExtensionSchema>;

export default createExtensionSchema;
