import { z } from "zod";

// Invariant: multipart fields get the same explicit contract as JSON bodies.
// Document codes are admin-configured (leave_types.required_documents, e.g.
// OFFER_LETTER) with a 50-char column bound — so the boundary is a bounded
// string in that shape, not an open-ended value. Unknown codes still reach
// the service, which normalizes and persists them; this schema only bounds
// size and charset at the API edge.
export const uploadDocumentSchema = z.object({
  documentType: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9 _-]+$/, "documentType contains unsupported characters")
    .default("GENERAL"),
});

export type UploadDocumentDto = z.infer<typeof uploadDocumentSchema>;

export default uploadDocumentSchema;
