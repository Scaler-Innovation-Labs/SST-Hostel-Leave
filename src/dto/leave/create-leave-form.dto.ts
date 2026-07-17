// create-leave-form.dto.ts

import { z } from "zod";

import { type CreateLeaveDto } from "./create-leave.dto";

export const createLeaveFormSchema = z
  .object({
    leaveTypeId: z.string().uuid(),

    reason: z.string().trim().min(10).max(1000),

    startAt: z.string().min(1),

    endAt: z.string().min(1),

    submittedForm: z.record(z.string(), z.unknown()).optional(),

    pocId: z.string().uuid().optional(),
  })
  .refine(
    (data) => new Date(data.startAt) < new Date(data.endAt),
    {
      message: "endAt must be after startAt",
      path: ["endAt"],
    }
  );

export type CreateLeaveFormDto =
  z.infer<typeof createLeaveFormSchema>;


export function mapFormToCreateLeaveDto(
  data: CreateLeaveFormDto
): CreateLeaveDto {
  return {
    ...data,
    pocId: data.pocId || undefined,
    startAt: new Date(data.startAt).toISOString(),
    endAt: new Date(data.endAt).toISOString(),
  };
}