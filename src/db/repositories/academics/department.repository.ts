import { asc } from "drizzle-orm";

import { departments } from "@/db/schema/academics";
import { db } from "@/lib/db";

type DepartmentSelectDbClient = Pick<typeof db, "select">;

export type DepartmentRow = {
  id: string;
  code: string;
  name: string;
};

export const departmentRepository = {
  async findAll(
    dbClient: DepartmentSelectDbClient = db
  ): Promise<DepartmentRow[]> {
    return dbClient
      .select({ id: departments.id, code: departments.code, name: departments.name })
      .from(departments)
      .orderBy(asc(departments.name));
  },
};

export default departmentRepository;
