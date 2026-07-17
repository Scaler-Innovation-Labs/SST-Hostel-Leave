import { z } from "zod";

export const saveAcademicGroupSchema = z.object({
  departmentId: z.string().uuid("Department is required"),
  batchYear: z.number().int().min(1900).max(2100),
  name: z.string().min(1, "Name is required"),
  groupCode: z.string().nullish(),
  isActive: z.boolean().default(true),
});

export type SaveAcademicGroupInput = z.infer<typeof saveAcademicGroupSchema>;
