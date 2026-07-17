import { z } from "zod";

export const saveDepartmentSchema = z.object({
  code: z.string().min(1, "Code is required").transform((v) => v.toUpperCase().replace(/\s+/g, "_")),
  name: z.string().min(1, "Name is required"),
});

export type SaveDepartmentInput = z.infer<typeof saveDepartmentSchema>;
