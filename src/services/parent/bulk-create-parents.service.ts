import { parentRepository } from "@/db/repositories/parent/parent.repository";

type BulkParentRow = {
  studentId: string;
  name: string;
  phone: string;
  email?: string | null;
  relationship: string;
  isPrimary: boolean;
};

export async function bulkCreateParents(rows: BulkParentRow[]): Promise<Array<{ row: number; success: boolean; error?: string }>> {
  const results: { row: number; success: boolean; error?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      await parentRepository.create({
        studentId: row.studentId,
        name: row.name,
        phone: row.phone,
        email: row.email ?? null,
        relationship: row.relationship,
        isPrimary: row.isPrimary,
      });

      results.push({ row: i + 1, success: true });
    } catch (err) {
      results.push({
        row: i + 1,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}
