import { type Department,departmentRepository } from "@/db/repositories/academics/department.repository";

export async function getDepartmentById(id: string): Promise<Department | null> {
  return departmentRepository.findById(id);
}
