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
};

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  className,
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
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className="
                    px-4 py-3 text-left
                    font-medium text-muted-foreground
                  "
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((row, index) => (
              <tr
                key={index}
                className="
                  border-b border-border
                  transition-colors
                  hover:bg-muted/40
                "
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className="px-4 py-4"
                  >
                    {column.render
                      ? column.render(
                          row[column.key],
                          row
                        )
                      : String(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}