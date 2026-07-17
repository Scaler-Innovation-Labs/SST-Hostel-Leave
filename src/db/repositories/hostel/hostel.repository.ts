import type { InferSelectModel } from "drizzle-orm";
import { asc, eq } from "drizzle-orm";

import { hostels } from "@/db/schema/hostel";
import { db } from "@/lib/db";

type HostelSelectDbClient = Pick<typeof db, "select">;
type HostelWriteDbClient = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export type HostelRow = {
  id: string;
  code: string;
  name: string;
};

export type Hostel = InferSelectModel<typeof hostels>;

export const hostelRepository = {
  async findAll(
    dbClient: HostelSelectDbClient = db
  ): Promise<HostelRow[]> {
    return dbClient
      .select({ id: hostels.id, code: hostels.code, name: hostels.name })
      .from(hostels)
      .orderBy(asc(hostels.name));
  },

  async findById(
    id: string,
    dbClient: HostelSelectDbClient = db
  ): Promise<Hostel | null> {
    const [row] = await dbClient
      .select()
      .from(hostels)
      .where(eq(hostels.id, id))
      .limit(1);

    return row ?? null;
  },

  async findByCode(
    code: string,
    dbClient: HostelSelectDbClient = db
  ): Promise<Hostel | null> {
    const [row] = await dbClient
      .select()
      .from(hostels)
      .where(eq(hostels.code, code))
      .limit(1);

    return row ?? null;
  },

  async create(
    input: typeof hostels.$inferInsert,
    dbClient: HostelWriteDbClient = db
  ): Promise<Hostel> {
    const [row] = await dbClient
      .insert(hostels)
      .values(input)
      .returning();

    return row!;
  },

  async updateById(
    id: string,
    input: Partial<typeof hostels.$inferInsert>,
    dbClient: HostelWriteDbClient = db
  ): Promise<Hostel | null> {
    const [row] = await dbClient
      .update(hostels)
      .set(input)
      .where(eq(hostels.id, id))
      .returning();

    return row ?? null;
  },

  async deleteById(
    id: string,
    dbClient: HostelWriteDbClient = db
  ): Promise<void> {
    await dbClient
      .delete(hostels)
      .where(eq(hostels.id, id));
  },
};

export default hostelRepository;
