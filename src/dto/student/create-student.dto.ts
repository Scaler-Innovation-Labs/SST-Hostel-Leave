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
  // Parent is created together with the student so every student has a
  // parent from the start — leaves that need parent approval never stall
  // on a missing parent record.
  parentName: z.string().min(1).max(200),
  parentPhone: z.string().min(10).max(15),
  parentEmail: z.string().email().optional().or(z.literal("")),
  parentRelationship: z.string().min(1).max(100),
});

export type CreateStudentDto = z.infer<typeof createStudentSchema>;

export default createStudentSchema;
