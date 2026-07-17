import type { InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";

import { inboundSmsLogs } from "@/db";
import { db } from "@/lib/db";

export type InboundSmsLog = InferSelectModel<typeof inboundSmsLogs>;

type LogDbClient = Pick<typeof db, "select">;

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
};

export default inboundSmsLogRepository;
