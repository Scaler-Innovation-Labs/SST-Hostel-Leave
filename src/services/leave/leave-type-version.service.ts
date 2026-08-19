import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import {
  type LeaveTypeVersion,
  leaveTypeVersionRepository,
} from "@/db/repositories/leave/leave-type-version.repository";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

type VersionDbClient = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export const leaveTypeVersionService = {
  /**
   * Creates a new immutable version of a leave type, capturing its current
   * state. Called only when the type is created or changed. Existing versions
   * are never mutated.
   */
  async createVersion(
    leaveTypeId: string,
    actorUserId: string | null = null,
    dbClient: VersionDbClient = db
  ): Promise<LeaveTypeVersion> {
    const leaveType = await leaveTypeRepository.findById(leaveTypeId, dbClient);
    if (!leaveType) {
      throw new NotFoundError("LeaveType");
    }

    const version = await leaveTypeVersionRepository.nextVersion(leaveTypeId, dbClient);

    return leaveTypeVersionRepository.create(
      {
        leaveTypeId,
        version,
        code: leaveType.code,
        name: leaveType.name,
        category: leaveType.category,
        description: leaveType.description,
        formSchema: leaveType.formSchema,
        qrMode: leaveType.qrMode,
        policyConfig: leaveType.policyConfig,
        notificationConfig: leaveType.notificationConfig,
        useGlobalNotificationRules: leaveType.useGlobalNotificationRules,
        requiredDocuments: leaveType.requiredDocuments,
        uiConfig: leaveType.uiConfig,
        workflowMode: leaveType.workflowMode,
        allowExtensions: leaveType.allowExtensions,
        maxExtensionCount: leaveType.maxExtensionCount,
        createdBy: actorUserId,
      },
      dbClient
    );
  },

  /**
   * Returns the latest version of a leave type, creating v1 from its current
   * state when none exists yet (types created before this feature shipped).
   */
  async getOrCreateLatestVersion(
    leaveTypeId: string,
    actorUserId: string | null = null,
    dbClient: VersionDbClient = db
  ): Promise<LeaveTypeVersion> {
    const existing = await leaveTypeVersionRepository.findLatestByLeaveTypeId(leaveTypeId, dbClient);
    if (existing) {
      return existing;
    }

    return this.createVersion(leaveTypeId, actorUserId, dbClient);
  },
};

export default leaveTypeVersionService;