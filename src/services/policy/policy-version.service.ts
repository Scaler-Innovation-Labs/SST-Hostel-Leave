import { type Policy,policyRepository } from "@/db/repositories/policy/policy.repository";
import {
  type PolicyVersion,
  policyVersionRepository,
} from "@/db/repositories/policy/policy-version.repository";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

type VersionDbClient = Pick<typeof db, "select" | "insert">;

export const policyVersionService = {
  /**
   * Creates a new immutable version of a policy, capturing its current state.
   * Called only when the policy is created or changed. Existing versions are
   * never mutated.
   */
  async createVersion(
    policyId: string,
    actorUserId: string | null = null,
    dbClient: VersionDbClient = db
  ): Promise<PolicyVersion> {
    const policy = await policyRepository.findById(policyId, dbClient);
    if (!policy) {
      throw new NotFoundError("Policy");
    }

    return this.createVersionFromPolicy(policy, actorUserId, dbClient);
  },

  /**
   * Resolves the latest version of each requested policy. Version creation
   * happens only on actual configuration mutation (createVersion); the
   * runtime never repairs missing versions — a missing version is a data
   * error and throws.
   */
  async getLatestVersions(
    policyIds: string[],
    dbClient: VersionDbClient = db
  ): Promise<Map<string, PolicyVersion>> {
    const result = await policyVersionRepository.findManyLatestByPolicyIds(policyIds, dbClient);

    const missing = policyIds.filter((policyId) => !result.has(policyId));
    if (missing.length > 0) {
      throw new NotFoundError(`PolicyVersion for policies: ${missing.join(", ")}`);
    }

    return result;
  },

  async createVersionFromPolicy(
    policy: Policy,
    actorUserId: string | null,
    dbClient: VersionDbClient
  ): Promise<PolicyVersion> {
    const version = await policyVersionRepository.nextVersion(policy.id, dbClient);

    return policyVersionRepository.create(
      {
        policyId: policy.id,
        version,
        name: policy.name,
        policyType: policy.policyType,
        priority: policy.priority,
        leaveTypeId: policy.leaveTypeId,
        hostelId: policy.hostelId,
        departmentId: policy.departmentId,
        batchYear: policy.batchYear,
        config: policy.config,
        isActive: policy.isActive,
        startsAt: policy.startsAt,
        endsAt: policy.endsAt,
        createdBy: actorUserId,
      },
      dbClient
    );
  },
};

export default policyVersionService;