import { z } from "zod";

export const InboundSmsSchema = z.object({
  from: z.string().min(1),
  body: z.string().min(1),
  providerMessageId: z.string().optional(),
});

export type InboundSms = z.infer<typeof InboundSmsSchema>;
