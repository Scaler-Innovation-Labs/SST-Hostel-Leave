import { z } from "zod";

export const parentVerifySchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().length(6),
});

export type ParentVerifyDto = z.infer<typeof parentVerifySchema>;

export default parentVerifySchema;
