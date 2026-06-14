import { eq } from "drizzle-orm";

import { roles } from "@/db";
import { db } from "@/lib/db";

export type Role = {
  id: string;
  code: string;
  name: string;
};

type RoleDbClient = Pick<typeof db, "select">;

export const roleRepository = {
  async findAll(
    dbClient: RoleDbClient = db
  ): Promise<Role[]> {
    const rows = await dbClient
      .select({
        id: roles.id,
        code: roles.code,
        name: roles.name,
      })
      .from(roles)
      .orderBy(roles.code);

    return rows;
  },

  async findByCode(
    code: string,
    dbClient: RoleDbClient = db
  ): Promise<Role | null> {
    const rows = await dbClient
      .select({
        id: roles.id,
        code: roles.code,
        name: roles.name,
      })
      .from(roles)
      .where(eq(roles.code, code))
      .limit(1);

    return rows[0] ?? null;
  },
};

export default roleRepository;
