import { z } from "zod";

// Shared boundary: sort keys are always bounded strings. Per-domain DTOs
// should narrow further with z.enum of the columns their repository actually
// supports (see list-leaves/list-users/list-students) — the repository
// allowlist stays as defense-in-depth, never as the only check.
export const sortSchema = z.object({
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type SortQuery = z.infer<typeof sortSchema>;
