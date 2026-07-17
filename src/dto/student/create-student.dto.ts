import { z } from "zod";

export const createStudentSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(10).max(15).optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  rollNumber: z.string().min(1).max(50),
  academicGroupId: z.string().uuid(),
  roomNumber: z.string().max(20).optional().nullable(),
  hostelId: z.string().uuid().optional().nullable(),
});

export type CreateStudentDto = z.infer<typeof createStudentSchema>;

export default createStudentSchema;
