import { z } from "zod";
import { sortSchema } from "@/dto/shared/sort.dto";

const listQrPassesSchema = z.object({
  sortBy: sortSchema.shape.sortBy,
  sortOrder: sortSchema.shape.sortOrder,
  leaveRequestId: z.string().uuid(),
});

export default listQrPassesSchema;

export type ListQrPassesQuery = z.infer<typeof listQrPassesSchema>;
