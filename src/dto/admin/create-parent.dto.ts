import { z } from "zod";

export const createParentSchema = z.object({
  studentId: z.string().uuid(),
  name: z.string().min(1).max(200),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal("")),
  relationship: z.string().min(1).max(100),
  isPrimary: z.boolean().default(false),
});

export type CreateParentDto = z.infer<typeof createParentSchema>;

export default createParentSchema;
