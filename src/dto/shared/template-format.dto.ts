import { z } from "zod";

export const TemplateFormatSchema = z.object({
  format: z.enum(["xlsx", "csv"]).default("xlsx"),
});

export type TemplateFormat = z.infer<typeof TemplateFormatSchema>;
