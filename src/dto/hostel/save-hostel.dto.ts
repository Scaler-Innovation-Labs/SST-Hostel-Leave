import { z } from "zod";

export const saveHostelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").transform((v) => v.toUpperCase().replace(/\s+/g, "_")),
  capacity: z.number().int().positive().nullish(),
  curfewStartTime: z.string().nullish(),
  curfewEndTime: z.string().nullish(),
  isActive: z.boolean().default(true),
});

export type SaveHostelInput = z.infer<typeof saveHostelSchema>;
