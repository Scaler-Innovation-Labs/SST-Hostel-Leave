import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";

import { inboundSmsLogs } from "@/db";
import { db } from "@/lib/db";

export type InboundSmsLog = InferSelectModel<typeof inboundSmsLogs>;
export type CreateInboundSmsLog = InferInsertModel<typeof inboundSmsLogs>;

type LogDbClient = Pick<typeof db, "select" | "insert">;

export const inboundSmsLogRepository = {
  async findByProviderMessageId(
    providerMessageId: string,
    dbClient: LogDbClient = db,
  ): Promise<InboundSmsLog | null> {
    const rows = await dbClient
      .select()
      .from(inboundSmsLogs)
      .where(
        and(
          eq(inboundSmsLogs.providerMessageId, providerMessageId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  },

  async create(
    data: CreateInboundSmsLog,
    dbClient: LogDbClient = db,
  ): Promise<InboundSmsLog> {
    const rows = await dbClient
      .insert(inboundSmsLogs)
      .values(data)
      .returning();

    return rows[0]!;
  },
};

export default inboundSmsLogRepository;
