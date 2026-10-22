import { parentRepository } from "@/db/repositories/parent/parent.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { NotFoundError } from "@/lib/errors";
import { maskPhoneNumber } from "@/utils/phone";

export type StudentContactItem = {
  id: string;
  name: string;
  relationship: string;
  maskedPhone: string;
  isPrimary: boolean;
  hasValidPhone: boolean;
};

export async function getStudentContacts(userId: string): Promise<StudentContactItem[]> {
  const student = await studentRepository.findByUserId(userId);
  if (!student) {
    throw new NotFoundError("Student");
  }

  const contacts = await parentRepository.findByStudentId(student.id);

  return contacts.map((c) => ({
    id: c.id,
    name: c.name,
    relationship: c.relationship,
    maskedPhone: maskPhoneNumber(c.phone),
    isPrimary: c.isPrimary,
    hasValidPhone: Boolean(c.phone && c.phone.trim().length > 0),
  }));
}
