import { z } from "zod";

export const verifyOtpSchema = z.object({
  otp: z.string().length(6),
});

export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

export default verifyOtpSchema;
