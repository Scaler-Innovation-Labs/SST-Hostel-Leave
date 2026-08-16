import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Visual treatment. Defaults to "bordered". */
  variant?: "bordered" | "ghost" | "plain";
  /** Where the page label sits. Defaults to "left". */
  labelPosition?: "left" | "center";
  /** Label rendering. Defaults to "page-of". */
  labelFormat?: "page-of" | "slash";
  /** Draw the top border. Defaults to true. */
  bordered?: boolean;
  className?: string;
};

function PaginationButton({
  direction,
  disabled,
  onClick,
  variant,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
  variant: "bordered" | "ghost" | "plain";
}) {
  if (variant === "plain") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {direction === "previous" ? "Previous" : "Next"}
      </button>
    );
  }

  return (
    <Button
      variant={variant === "ghost" ? "ghost" : "outline"}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={cn(variant === "ghost" && "gap-1")}
    >
      {direction === "previous" && variant === "ghost" && (
        <ChevronLeft className="h-4 w-4" />
      )}
      {direction === "previous" ? "Previous" : "Next"}
      {direction === "next" && variant === "ghost" && (
        <ChevronRight className="h-4 w-4" />
      )}
    </Button>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  variant = "bordered",
  labelPosition = "left",
  labelFormat = "page-of",
  bordered = true,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const previous = () => onPageChange(Math.max(1, page - 1));
  const next = () => onPageChange(Math.min(totalPages, page + 1));

  const prevButton = (
    <PaginationButton
      direction="previous"
      disabled={page <= 1}
      onClick={previous}
      variant={variant}
    />
  );
  const nextButton = (
    <PaginationButton
      direction="next"
      disabled={page >= totalPages}
      onClick={next}
      variant={variant}
    />
  );
  const label = (
    <span className="text-xs text-muted-foreground">
      {labelFormat === "page-of"
        ? `Page ${page} of ${totalPages}`
        : `${page} / ${totalPages}`}
    </span>
  );

  return (
    <div
      className={cn(
        "flex items-center justify-between pt-4",
        bordered && "border-t border-border",
        className,
      )}
    >
      {labelPosition === "center" ? (
        <>
          {prevButton}
          {label}
          {nextButton}
        </>
      ) : (
        <>
          {label}
          <div className="flex items-center gap-2">
            {prevButton}
            {nextButton}
          </div>
        </>
      )}
    </div>
  );
}