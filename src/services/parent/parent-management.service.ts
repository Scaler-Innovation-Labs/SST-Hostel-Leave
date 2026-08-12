import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { type Parent,parentRepository } from "@/db/repositories/parent/parent.repository";
import type { CreateParentDto } from "@/dto/admin/create-parent.dto";
import type { UpdateParentDto } from "@/dto/admin/update-parent.dto";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export const parentManagementService = {
  async list(filters: { search?: string; studentId?: string; page: number; limit: number }): Promise<Awaited<ReturnType<typeof parentRepository.findAll>>> {
    return parentRepository.findAll(filters);
  },

  async getById(id: string): Promise<Parent> {
    const parent = await parentRepository.findById(id);
    if (!parent) throw new NotFoundError("Parent");
    return parent;
  },

  async create(dto: CreateParentDto, actorUserId: string | null = null): Promise<Parent> {
    const parent = await parentRepository.create({
      studentId: dto.studentId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email || null,
      relationship: dto.relationship,
      isPrimary: dto.isPrimary,
    });

    if (actorUserId) {
      await auditService.record(
        AUDIT_ACTION.CREATE,
        AUDIT_ENTITY_TYPE.STUDENT,
        dto.studentId,
        actorUserId,
        { parentId: parent.id, name: dto.name },
      );
    }

    return parent;
  },

  async update(id: string, dto: UpdateParentDto, actorUserId: string | null = null): Promise<Parent | null> {
    const parent = await parentRepository.findById(id);
    if (!parent) throw new NotFoundError("Parent");

    const updated = await parentRepository.updateById(id, dto);

    if (actorUserId) {
      await auditService.record(
        AUDIT_ACTION.UPDATE,
        AUDIT_ENTITY_TYPE.STUDENT,
        parent.studentId,
        actorUserId,
        { parentId: id, dto },
      );
    }

    return updated;
  },

  async delete(id: string, actorUserId: string | null = null): Promise<void> {
    const parent = await parentRepository.findById(id);
    if (!parent) throw new NotFoundError("Parent");

    await parentRepository.deleteById(id);

    if (actorUserId) {
      await auditService.record(
        AUDIT_ACTION.DELETE,
        AUDIT_ENTITY_TYPE.STUDENT,
        parent.studentId,
        actorUserId,
        { parentId: id },
      );
    }
  },
};
