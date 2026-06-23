import { departmentRepository } from "@/db/repositories/academics/department.repository";

export async function listDepartments() {
  return departmentRepository.findAll();
}
