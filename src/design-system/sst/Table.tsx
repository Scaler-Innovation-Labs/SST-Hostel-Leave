import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The scroll container. A wide table scrolls inside its own box; the page body
 * never scrolls sideways. Below `md` a table should become stacked cards
 * instead — it is never squeezed.
 */
function TableScroll({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-scroll"
      className={cn("w-full overflow-x-auto", className)}
      {...props}
    />
  );
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="table"
      className={cn("w-full caption-bottom border-collapse text-body", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      className={cn("mt-3 text-caption text-muted", className)}
      {...props}
    />
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("border-b border-border", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody className={cn("divide-y divide-border", className)} {...props} />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "h-row transition-colors duration-fast ease-standard hover:bg-surface-hover",
        className
      )}
      {...props}
    />
  );
}

type TableHeadProps = React.ComponentProps<"th"> & {
  /** Right-aligns and tabulates — every column of figures. */
  numeric?: boolean;
};

function TableHead({ className, numeric, ...props }: TableHeadProps) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-muted",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  );
}

type TableCellProps = React.ComponentProps<"td"> & {
  numeric?: boolean;
};

function TableCell({ className, numeric, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        "px-3 py-2 text-body text-ink",
        numeric && "text-right tabular-nums",
        className
      )}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
};
