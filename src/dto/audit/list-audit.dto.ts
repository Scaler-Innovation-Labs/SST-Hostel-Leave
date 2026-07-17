import { z } from "zod";
import { sortSchema } from "@/dto/shared/sort.dto";

export const listAuditSchema = z.object({
  entityType: z.string().min(1, "entityType is required"),
  entityId: z.string().min(1, "entityId is required"),
  sortBy: sortSchema.shape.sortBy,
  sortOrder: sortSchema.shape.sortOrder,
});

export type ListAuditQuery = z.infer<typeof listAuditSchema>;

export default listAuditSchema;
