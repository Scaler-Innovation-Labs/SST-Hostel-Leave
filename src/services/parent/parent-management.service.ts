import { type Parent,parentRepository } from "@/db/repositories/parent/parent.repository";
import type { CreateParentDto } from "@/dto/admin/create-parent.dto";
import type { UpdateParentDto } from "@/dto/admin/update-parent.dto";
import { NotFoundError } from "@/lib/errors";

export const parentManagementService = {
  async list(filters: { search?: string; studentId?: string; page: number; limit: number }): Promise<Awaited<ReturnType<typeof parentRepository.findAll>>> {
    return parentRepository.findAll(filters);
  },

  async getById(id: string): Promise<Parent> {
    const parent = await parentRepository.findById(id);
    if (!parent) throw new NotFoundError("Parent");
    return parent;
  },

  async create(dto: CreateParentDto): Promise<Parent> {
    return parentRepository.create({
      studentId: dto.studentId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email || null,
      relationship: dto.relationship,
      isPrimary: dto.isPrimary,
    });
  },

  async update(id: string, dto: UpdateParentDto): Promise<Parent | null> {
    const parent = await parentRepository.findById(id);
    if (!parent) throw new NotFoundError("Parent");

    return parentRepository.updateById(id, dto);
  },

  async delete(id: string): Promise<void> {
    const parent = await parentRepository.findById(id);
    if (!parent) throw new NotFoundError("Parent");

    await parentRepository.deleteById(id);
  },
};
