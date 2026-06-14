import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";

export async function listLeaveExtensions(
  leaveRequestId: string,
  _query: { page: number; limit: number }
) {
  const items = await leaveExtensionRepository.findByLeaveRequestId(leaveRequestId);

  return {
    items,
    total: items.length,
    page: 1,
    limit: items.length || 20,
    totalPages: 1,
  };
}

