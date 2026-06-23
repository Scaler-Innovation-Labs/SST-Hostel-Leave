import { z } from "zod";

const testChannelSchema = z.object({
  channel: z.enum(["email", "sms", "slack"]),
  recipient: z.string().optional(),
});

export default testChannelSchema;

export type TestChannelQuery = z.infer<typeof testChannelSchema>;
