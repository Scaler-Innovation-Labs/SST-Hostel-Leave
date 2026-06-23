import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { policyRepository } from "@/db/repositories/policy/policy.repository";
import type { SavePolicyDto } from "@/dto/policy/save-policy.dto";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

function toPolicyInput(dto: SavePolicyDto) {
  return {
    ...dto,
    leaveTypeId: dto.leaveTypeId ?? null,
    hostelId: dto.hostelId ?? null,
    departmentId: dto.departmentId ?? null,
    batchYear: dto.batchYear ?? null,
    startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
    endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
  };
}

export async function listPolicies() {
  return policyRepository.findAll();
}

export async function getPolicyById(id: string) {
  const policy = await policyRepository.findById(id);
  if (!policy) throw new NotFoundError("Policy");
  return policy;
}

export async function createPolicy(dto: SavePolicyDto, actorUserId: string) {
  return db.transaction(async (tx) => {
    const policy = await policyRepository.create(toPolicyInput(dto), tx);
    await auditService.record(AUDIT_ACTION.CREATE, AUDIT_ENTITY_TYPE.POLICY, policy.id, actorUserId, { name: policy.name, policyType: policy.policyType }, tx);
    return policy;
  });
}

export async function updatePolicy(id: string, dto: SavePolicyDto, actorUserId: string) {
  return db.transaction(async (tx) => {
    if (!await policyRepository.findById(id, tx)) throw new NotFoundError("Policy");
    const policy = await policyRepository.update(id, toPolicyInput(dto), tx);
    await auditService.record(AUDIT_ACTION.UPDATE, AUDIT_ENTITY_TYPE.POLICY, id, actorUserId, { name: dto.name, policyType: dto.policyType }, tx);
    return policy;
  });
}

export async function deletePolicy(id: string, actorUserId: string) {
  return db.transaction(async (tx) => {
    if (!await policyRepository.findById(id, tx)) throw new NotFoundError("Policy");
    await policyRepository.deleteById(id, tx);
    await auditService.record(AUDIT_ACTION.DELETE, AUDIT_ENTITY_TYPE.POLICY, id, actorUserId, { deleted: true }, tx);
  });
}
