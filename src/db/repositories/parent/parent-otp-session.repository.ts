import type { InferSelectModel } from "drizzle-orm";
import { and, eq, gte, isNull, lt } from "drizzle-orm";

import { parentOtpSessions } from "@/db";
import { db } from "@/lib/db";

export type ParentOtpSession = InferSelectModel<typeof parentOtpSessions>;

type OtpDbClient = Pick<typeof db, "insert" | "select" | "update">;
type OtpDeleteDbClient = Pick<typeof db, "insert" | "select" | "update" | "delete">;

export const parentOtpSessionRepository = {
  async create(
    data: {
      parentId: string;
      phone: string;
      otpHash: string;
      expiresAt: Date;
    },
    dbClient: OtpDbClient = db
  ): Promise<ParentOtpSession> {
    const rows = await dbClient
      .insert(parentOtpSessions)
      .values(data)
      .returning();

    return rows[0]!;
  },

  async findValidByPhone(
    phone: string,
    dbClient: OtpDbClient = db
  ): Promise<ParentOtpSession | null> {
    const rows = await dbClient
      .select()
      .from(parentOtpSessions)
      .where(
        and(
          eq(parentOtpSessions.phone, phone),
          gte(parentOtpSessions.expiresAt, new Date()),
          isNull(parentOtpSessions.verifiedAt)
        )
      )
      .orderBy(parentOtpSessions.createdAt)
      .limit(1);

    return rows[0] ?? null;
  },

  async markVerified(
    id: string,
    dbClient: OtpDbClient = db
  ): Promise<void> {
    await dbClient
      .update(parentOtpSessions)
      .set({ verifiedAt: new Date() })
      .where(eq(parentOtpSessions.id, id));
  },

  async deleteExpired(
    before: Date,
    dbClient: OtpDeleteDbClient = db
  ): Promise<number> {
    const result = await dbClient
      .delete(parentOtpSessions)
      .where(lt(parentOtpSessions.expiresAt, before))
      .returning({ id: parentOtpSessions.id });

    return result.length;
  },

  async invalidateByParentId(
    parentId: string,
    dbClient: OtpDbClient = db
  ): Promise<void> {
    await dbClient
      .update(parentOtpSessions)
      .set({
        expiresAt: new Date(0),
      })
      .where(
        and(
          eq(parentOtpSessions.parentId, parentId),
          isNull(parentOtpSessions.verifiedAt)
        )
      );
  },
};

export default parentOtpSessionRepository;
