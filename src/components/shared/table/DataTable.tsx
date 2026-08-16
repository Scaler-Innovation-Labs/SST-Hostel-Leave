import { Pagination } from "@/components/shared/Pagination";
import { cn } from "@/lib/utils";

type Column<T> = {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
};

type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  className?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
};

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  className,
  page = 1,
  totalPages,
  onPageChange,
  isLoading,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              {columns.map((column, i) => (
                <th
                  key={`${String(column.key)}-${i}`}
                  className="px-4 py-3 text-left font-medium text-muted-foreground"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.length === 0 && !isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No data found
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={index}
                  className={cn(
                    "border-b border-border transition-colors hover:bg-muted/40",
                    index % 2 === 1 && "bg-muted/20",
                  )}
                >
                  {columns.map((column, i) => (
                    <td key={`${String(column.key)}-${i}`} className="px-4 py-4">
                      {column.render
                        ? column.render(row[column.key], row)
                        : String(row[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages !== undefined && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => onPageChange?.(p)}
          className="px-4 py-3"
        />
      )}
    </div>
  );
}