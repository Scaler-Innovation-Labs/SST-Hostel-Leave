import { z } from "zod";

export const superadminOverrideSchema = z.object({
  mode: z.enum(["ONE_STEP", "ALL"], {
    message: "mode must be ONE_STEP or ALL",
  }),
  comments: z.string().optional(),
});

export type SuperadminOverrideDto = z.infer<typeof superadminOverrideSchema>;
