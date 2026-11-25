"use client";

import { StudentsDirectoryView } from "@/features/students/components/StudentsDirectoryView";

export default function AdminStudentsPage() {
  return <StudentsDirectoryView detailBasePath="/admin/students" />;
}
