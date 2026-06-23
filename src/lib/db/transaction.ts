import { db } from "@/lib/db";

type TransactionTx = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export type DbClient = Pick<typeof db, "insert" | "select" | "update" | "delete">;

export async function transaction<T>(
  callback: (tx: DbClient) => Promise<T>
): Promise<T> {
  return db.transaction(
    callback as (tx: TransactionTx) => Promise<T>
  );
}
