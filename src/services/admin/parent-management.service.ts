import { parentRepository } from "@/db/repositories/hostel/parent.repository";
import type { CreateParentDto } from "@/dto/admin/create-parent.dto";
import type { UpdateParentDto } from "@/dto/admin/update-parent.dto";
import { NotFoundError } from "@/lib/errors";

export const parentManagementService = {
  async list(filters: { search?: string; page: number; limit: number }) {
    return parentRepository.findAll(filters);
  },

  async getById(id: string) {
    const parent = await parentRepository.findById(id);
    if (!parent) throw new NotFoundError("Parent");
    return parent;
  },

  async create(dto: CreateParentDto) {
    return parentRepository.create({
      studentId: dto.studentId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email || null,
      relationship: dto.relationship,
      isPrimary: dto.isPrimary,
    });
  },

  async update(id: string, dto: UpdateParentDto) {
    const parent = await parentRepository.findById(id);
    if (!parent) throw new NotFoundError("Parent");

    return parentRepository.updateById(id, dto);
  },
};
