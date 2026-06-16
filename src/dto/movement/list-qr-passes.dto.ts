import { z } from "zod";

const listQrPassesSchema = z.object({
  leaveRequestId: z.string().uuid(),
});

export default listQrPassesSchema;

export type ListQrPassesQuery = z.infer<typeof listQrPassesSchema>;
