import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

export type RateLimitEntry = {
  key: string;
  count: number;
  resetAt: Date;
};

export const rateLimitRepository = {
  /**
   * Atomically increments the fixed-window counter for `key`. When the
   * current window has expired the counter resets to 1 and a fresh window
   * starts; otherwise it increments. Safe under concurrency via the UPSERT.
   */
  async increment(
    key: string,
    windowMs: number
  ): Promise<RateLimitEntry> {
    const result = await db.execute(sql`
      INSERT INTO rate_limit_entries (key, count, reset_at)
      VALUES (
        ${key},
        1,
        now() + (${windowMs} || ' milliseconds')::interval
      )
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limit_entries.reset_at <= now()
            THEN 1
          ELSE rate_limit_entries.count + 1
        END,
        reset_at = CASE
          WHEN rate_limit_entries.reset_at <= now()
            THEN now() + (${windowMs} || ' milliseconds')::interval
          ELSE rate_limit_entries.reset_at
        END,
        updated_at = now()
      RETURNING key, count, reset_at;
    `);

    const row = result.rows[0] as Record<string, unknown> | undefined;

    if (!row) {
      throw new Error("Rate limit increment returned no row");
    }

    return {
      key: String(row.key),
      count: Number(row.count),
      resetAt: new Date(String(row.reset_at)),
    };
  },
};
