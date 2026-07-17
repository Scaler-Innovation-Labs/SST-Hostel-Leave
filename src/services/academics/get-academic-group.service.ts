import { academicGroupRepository, type AcademicGroupRow } from "@/db/repositories/academics/academic-group.repository";

export async function getAcademicGroupById(id: string): Promise<AcademicGroupRow | null> {
  return academicGroupRepository.findById(id);
}
