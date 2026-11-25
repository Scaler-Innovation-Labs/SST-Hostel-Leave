"use client";

import { StudentsDirectoryView } from "@/features/students/components/StudentsDirectoryView";

export default function SuperAdminStudentsPage() {
  return <StudentsDirectoryView detailBasePath="/super-admin/students" />;
}
