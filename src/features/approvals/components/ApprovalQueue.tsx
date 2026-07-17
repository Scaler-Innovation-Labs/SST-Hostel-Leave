"use client";

import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ApprovalCard, type ApprovalCardItem } from "./ApprovalCard";

type ApprovalQueueProps = {
  items: ApprovalCardItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  className?: string;
};

export function ApprovalQueue({
  items,
  selectedId,
  onSelect,
  page,
  totalPages,
  total,
  onPageChange,
  isLoading,
  className,
}: ApprovalQueueProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl bg-muted"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center",
          className,
        )}
      >
        <Inbox className="mb-3 h-12 w-12 text-muted-foreground/50" />
        <h3 className="text-base font-medium">No approvals found</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {total === 0
            ? "All caught up! No pending approvals to review."
            : "Try adjusting your filters to find what you're looking for."}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Result count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{total}</span> request{total !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </p>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {items.map((item) => (
          <ApprovalCard
            key={item.id}
            item={item}
            isSelected={item.id === selectedId}
            onClick={() => onSelect(item.id)}
            isOverdue={false}
            isParentPending={false}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
