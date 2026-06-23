import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { asc, eq } from "drizzle-orm";

import { leaveTypes } from "@/db";
import { db } from "@/lib/db";

export type LeaveType = InferSelectModel<typeof leaveTypes>;

type LeaveTypeDbClient = Pick<typeof db, "select">;

export const leaveTypeRepository = {
  async findAll(
    dbClient: LeaveTypeDbClient = db
  ): Promise<LeaveType[]> {
    const rows = await dbClient
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.isActive, true))
      .orderBy(asc(leaveTypes.name));

    return rows;
  },

  async findById(
    id: string,
    dbClient: LeaveTypeDbClient = db
  ): Promise<LeaveType | null> {
    const rows = await dbClient
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async findByCode(
    code: string,
    dbClient: LeaveTypeDbClient = db
  ): Promise<LeaveType | null> {
    const rows = await dbClient
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.code, code))
      .limit(1);

    return rows[0] ?? null;
  },

  async findAllIncludingInactive(
    dbClient: LeaveTypeDbClient = db
  ): Promise<LeaveType[]> {
    return dbClient
      .select()
      .from(leaveTypes)
      .orderBy(asc(leaveTypes.name));
  },

  async create(
    input: InferInsertModel<typeof leaveTypes>,
    dbClient: Pick<typeof db, "insert"> = db
  ): Promise<LeaveType> {
    const rows = await dbClient
      .insert(leaveTypes)
      .values(input)
      .returning();
    return rows[0]!;
  },

  async update(
    id: string,
    input: Partial<InferInsertModel<typeof leaveTypes>>,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<LeaveType | null> {
    const rows = await dbClient
      .update(leaveTypes)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(leaveTypes.id, id))
      .returning();
    return rows[0] ?? null;
  },

  async softDelete(
    id: string,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<boolean> {
    const rows = await dbClient
      .update(leaveTypes)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(leaveTypes.id, id))
      .returning({ id: leaveTypes.id });
    return rows.length > 0;
  },
};

export default leaveTypeRepository;
