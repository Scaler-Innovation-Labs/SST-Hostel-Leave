import type { InferSelectModel } from "drizzle-orm";
import { asc, eq } from "drizzle-orm";

import { departments } from "@/db/schema/academics";
import { db } from "@/lib/db";

type DepartmentSelectDbClient = Pick<typeof db, "select">;
type DepartmentWriteDbClient = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export type DepartmentRow = {
  id: string;
  code: string;
  name: string;
};

export type Department = InferSelectModel<typeof departments>;

export const departmentRepository = {
  async findAll(
    dbClient: DepartmentSelectDbClient = db
  ): Promise<DepartmentRow[]> {
    return dbClient
      .select({ id: departments.id, code: departments.code, name: departments.name })
      .from(departments)
      .orderBy(asc(departments.name));
  },

  async findById(
    id: string,
    dbClient: DepartmentSelectDbClient = db
  ): Promise<Department | null> {
    const [row] = await dbClient
      .select()
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);

    return row ?? null;
  },

  async findByCode(
    code: string,
    dbClient: DepartmentSelectDbClient = db
  ): Promise<Department | null> {
    const [row] = await dbClient
      .select()
      .from(departments)
      .where(eq(departments.code, code))
      .limit(1);

    return row ?? null;
  },

  async create(
    input: typeof departments.$inferInsert,
    dbClient: DepartmentWriteDbClient = db
  ): Promise<Department> {
    const [row] = await dbClient
      .insert(departments)
      .values(input)
      .returning();

    return row!;
  },

  async updateById(
    id: string,
    input: Partial<typeof departments.$inferInsert>,
    dbClient: DepartmentWriteDbClient = db
  ): Promise<Department | null> {
    const [row] = await dbClient
      .update(departments)
      .set(input)
      .where(eq(departments.id, id))
      .returning();

    return row ?? null;
  },

  async deleteById(
    id: string,
    dbClient: DepartmentWriteDbClient = db
  ): Promise<void> {
    await dbClient
      .delete(departments)
      .where(eq(departments.id, id));
  },
};

export default departmentRepository;
