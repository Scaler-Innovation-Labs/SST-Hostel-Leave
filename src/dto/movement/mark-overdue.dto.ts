import { z } from "zod";

export const markOverdueSchema = z.object({
  studentId: z.string().uuid(),
  leaveRequestId: z.string().uuid().optional(),
});

export type MarkOverdueDto = z.infer<typeof markOverdueSchema>;

export default markOverdueSchema;
