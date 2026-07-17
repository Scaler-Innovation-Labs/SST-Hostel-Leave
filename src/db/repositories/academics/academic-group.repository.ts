import type { InferSelectModel } from "drizzle-orm";
import { and, asc, eq } from "drizzle-orm";

import { academicGroups } from "@/db/schema/academics";
import { db } from "@/lib/db";

type AcademicGroupSelectDbClient = Pick<typeof db, "select">;
type AcademicGroupWriteDbClient = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export type AcademicGroupRow = InferSelectModel<typeof academicGroups>;

export const academicGroupRepository = {
  async findAll(
    dbClient: AcademicGroupSelectDbClient = db
  ): Promise<AcademicGroupRow[]> {
    return dbClient
      .select()
      .from(academicGroups)
      .orderBy(asc(academicGroups.name));
  },

  async findById(
    id: string,
    dbClient: AcademicGroupSelectDbClient = db
  ): Promise<AcademicGroupRow | null> {
    const [row] = await dbClient
      .select()
      .from(academicGroups)
      .where(eq(academicGroups.id, id))
      .limit(1);

    return row ?? null;
  },

  async findByUnique(
    departmentId: string,
    batchYear: number,
    groupCode?: string | null,
    dbClient: AcademicGroupSelectDbClient = db
  ): Promise<AcademicGroupRow | null> {
    const conditions: ReturnType<typeof and>[] = [
      eq(academicGroups.departmentId, departmentId),
      eq(academicGroups.batchYear, batchYear),
    ];

    if (groupCode !== undefined && groupCode !== null) {
      conditions.push(eq(academicGroups.groupCode, groupCode));
    }

    const [row] = await dbClient
      .select()
      .from(academicGroups)
      .where(and(...conditions))
      .limit(1);

    return row ?? null;
  },

  async create(
    input: typeof academicGroups.$inferInsert,
    dbClient: AcademicGroupWriteDbClient = db
  ): Promise<AcademicGroupRow> {
    const [row] = await dbClient
      .insert(academicGroups)
      .values(input)
      .returning();

    return row!;
  },

  async updateById(
    id: string,
    input: Partial<typeof academicGroups.$inferInsert>,
    dbClient: AcademicGroupWriteDbClient = db
  ): Promise<AcademicGroupRow | null> {
    const [row] = await dbClient
      .update(academicGroups)
      .set(input)
      .where(eq(academicGroups.id, id))
      .returning();

    return row ?? null;
  },

  async deleteById(
    id: string,
    dbClient: AcademicGroupWriteDbClient = db
  ): Promise<void> {
    await dbClient
      .delete(academicGroups)
      .where(eq(academicGroups.id, id));
  },
};

export default academicGroupRepository;
