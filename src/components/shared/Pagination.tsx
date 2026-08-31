import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/design-system/sst";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

/**
 * Previous / next with the position stated between them.
 *
 * One treatment, down from three variants crossed with two label positions
 * and two label formats — there was never a rule for which to use, and a
 * pager that looks different on two screens reads as two products.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex items-center justify-between gap-4 border-t border-border pt-4",
        className
      )}
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Previous
      </Button>

      <p
        aria-live="polite"
        className="font-mono text-micro uppercase tracking-wider text-muted"
      >
        Page <span className="tabular-nums text-ink">{page}</span> of{" "}
        <span className="tabular-nums text-ink">{totalPages}</span>
      </p>

      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </nav>
  );
}
