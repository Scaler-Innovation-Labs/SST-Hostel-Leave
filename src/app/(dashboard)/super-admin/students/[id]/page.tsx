"use client";

import { useParams } from "next/navigation";

import { StudentDetailView } from "@/features/students/components/StudentDetailView";

export default function SuperAdminStudentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <StudentDetailView studentId={id} basePath="/super-admin/students" />;
}
