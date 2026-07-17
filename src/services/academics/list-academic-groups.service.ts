import { academicGroupRepository, type AcademicGroupRow } from "@/db/repositories/academics/academic-group.repository";

export async function listAcademicGroups(): Promise<AcademicGroupRow[]> {
  return academicGroupRepository.findAll();
}
