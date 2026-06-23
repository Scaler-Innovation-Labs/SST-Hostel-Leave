import { z } from "zod";

export const listAuditSchema = z.object({
  entityType: z.string().min(1, "entityType is required"),
  entityId: z.string().min(1, "entityId is required"),
});

export type ListAuditQuery = z.infer<typeof listAuditSchema>;

export default listAuditSchema;
