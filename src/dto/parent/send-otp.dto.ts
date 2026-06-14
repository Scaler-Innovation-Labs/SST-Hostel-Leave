import { z } from "zod";

export const sendOtpSchema = z.object({
  phone: z.string().min(10).max(15),
});

export type SendOtpDto = z.infer<typeof sendOtpSchema>;

export default sendOtpSchema;
