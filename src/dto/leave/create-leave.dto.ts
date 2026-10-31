import { z } from "zod";

export const createLeaveSchema = z
  .object({
    leaveTypeId: z.string().uuid(),
    reason: z.string().trim().min(10).max(1000),

    startAt: z.string().datetime(),

    endAt: z.string().datetime(),

    submittedForm: z.record(z.string(), z.unknown()).optional(),

    pocId: z.string().uuid().optional(),
    approvalContactId: z.string().uuid().optional(),
  })
  .refine(
    (data) =>
      new Date(data.startAt) <
      new Date(data.endAt),
    {
      message: "Return time must be after departure time",
      path: ["endAt"],
    }
  );

export type CreateLeaveDto = z.infer<typeof createLeaveSchema>;

export default createLeaveSchema;
