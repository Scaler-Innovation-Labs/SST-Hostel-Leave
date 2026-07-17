import type { SQL } from "drizzle-orm";
import { asc, desc } from "drizzle-orm";

export function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: "asc" | "desc",
  columnMap: Record<string, SQL>
): SQL[] {
  if (!sortBy || !columnMap[sortBy]) {
    return [];
  }

  const column = columnMap[sortBy];
  const order = sortOrder === "asc" ? asc(column) : desc(column);

  return [order];
}
