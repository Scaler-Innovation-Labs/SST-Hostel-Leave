import { z } from "zod";

export const parentSendOtpSchema = z.object({
  phone: z.string().min(10).max(15),
});

export type ParentSendOtpDto = z.infer<typeof parentSendOtpSchema>;

export default parentSendOtpSchema;
