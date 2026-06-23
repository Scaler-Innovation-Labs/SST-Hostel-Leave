import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, desc, eq, or } from "drizzle-orm";

import { leaveDocuments } from "@/db";
import { db } from "@/lib/db";

type LeaveDocumentDbClient = Pick<typeof db, "insert" | "select" | "update" | "delete">;

export type LeaveDocument = InferSelectModel<typeof leaveDocuments>;
export type NewLeaveDocument = InferInsertModel<typeof leaveDocuments>;
type DocumentStatus = LeaveDocument["documentStatus"];

export const leaveDocumentRepository = {
  async create(
    input: NewLeaveDocument,
    dbClient: LeaveDocumentDbClient = db,
  ): Promise<LeaveDocument> {
    const rows = await dbClient
      .insert(leaveDocuments)
      .values(input)
      .returning();

    return rows[0]!;
  },

  async findById(
    id: string,
    dbClient: Pick<LeaveDocumentDbClient, "select"> = db,
  ): Promise<LeaveDocument | null> {
    const rows = await dbClient
      .select()
      .from(leaveDocuments)
      .where(eq(leaveDocuments.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async findByLeaveRequestId(
    leaveRequestId: string,
    dbClient: Pick<LeaveDocumentDbClient, "select"> = db,
    statuses?: DocumentStatus[],
  ): Promise<LeaveDocument[]> {
    if (statuses && statuses.length > 0) {
      const statusConditions = statuses.map((s) =>
        eq(leaveDocuments.documentStatus, s),
      );

      const rows = await dbClient
        .select()
        .from(leaveDocuments)
        .where(
          and(
            eq(leaveDocuments.leaveRequestId, leaveRequestId),
            or(...statusConditions),
          ),
        )
        .orderBy(desc(leaveDocuments.createdAt));

      return rows;
    }

    const rows = await dbClient
      .select()
      .from(leaveDocuments)
      .where(eq(leaveDocuments.leaveRequestId, leaveRequestId))
      .orderBy(desc(leaveDocuments.createdAt));

    return rows;
  },

  async updateStatus(
    id: string,
    documentStatus: DocumentStatus,
    dbClient: Pick<LeaveDocumentDbClient, "update"> = db,
  ): Promise<LeaveDocument | null> {
    const rows = await dbClient
      .update(leaveDocuments)
      .set({ documentStatus })
      .where(eq(leaveDocuments.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async delete(
    id: string,
    dbClient: Pick<LeaveDocumentDbClient, "delete"> = db,
  ): Promise<void> {
    await dbClient
      .delete(leaveDocuments)
      .where(eq(leaveDocuments.id, id));
  },
};

export default leaveDocumentRepository;
