"use client";

import { format, parseISO } from "date-fns";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type AuditEntry = {
  label: string;
  time: Date | string | null;
  status: "done" | "pending" | "failed";
};

type AuditDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: AuditEntry[];
};

function formatDt(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "MMM d h:mm a");
}

export function AuditDrawer({ open, onOpenChange, entries }: AuditDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Audit Timeline</SheetTitle>
          <SheetDescription>Key events for this leave request</SheetDescription>
        </SheetHeader>
        <div className="space-y-1 px-1">
          {entries.map((entry) => (
            <div key={entry.label} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/50">
              <span className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                entry.status === "done" ? "bg-emerald-500/10 text-emerald-600" :
                entry.status === "failed" ? "bg-red-500/10 text-red-600" :
                "bg-muted text-muted-foreground",
              )}>
                {entry.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                 entry.status === "failed" ? <XCircle className="h-3.5 w-3.5" /> :
                 <Clock className="h-3.5 w-3.5" />}
              </span>
              <span className="flex-1 font-medium">{entry.label}</span>
              <span className="text-xs text-muted-foreground">{formatDt(entry.time)}</span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
