import { z } from "zod";

export const markOverdueSchema = z.object({
  studentId: z.string().uuid(),
});

export type MarkOverdueDto = z.infer<typeof markOverdueSchema>;

export default markOverdueSchema;
