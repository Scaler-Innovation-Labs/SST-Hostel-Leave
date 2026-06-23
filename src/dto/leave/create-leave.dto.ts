import { z } from "zod";

export const createLeaveSchema = z
  .object({
    leaveTypeId: z.string().uuid(),
    reason: z.string().trim().min(10).max(1000),

    startAt: z.string().datetime(),

    endAt: z.string().datetime(),

    expectedReturnAt: z.string().datetime().optional(),

    submittedForm: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) =>
      new Date(data.startAt) <
      new Date(data.endAt),
    {
      message: "endAt must be after startAt",
      path: ["endAt"],
    }
  );

export type CreateLeaveDto = z.infer<typeof createLeaveSchema>;

export default createLeaveSchema;
