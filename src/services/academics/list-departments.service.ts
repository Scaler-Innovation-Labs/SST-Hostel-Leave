import { departmentRepository, type DepartmentRow } from "@/db/repositories/academics/department.repository";

export async function listDepartments(): Promise<DepartmentRow[]> {
  return departmentRepository.findAll();
}
