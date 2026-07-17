import { z } from "zod";

export const updateStudentSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  rollNumber: z.string().optional(),
  academicGroupId: z.string().optional(),
  roomNumber: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  hostelId: z.string().optional().nullable(),
});

export type UpdateStudentDto = z.infer<typeof updateStudentSchema>;

export default updateStudentSchema;
