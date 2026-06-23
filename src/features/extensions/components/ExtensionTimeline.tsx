"use client";

import { ExtensionStatusBadge } from "./ExtensionStatusBadge";

type TimelineEntry = {
  id: string;
  extensionNumber: number;
  status: string;
  reason: string;
  requestedEndAt: string;
  createdAt: string;
};

interface ExtensionTimelineProps {
  extensions: TimelineEntry[];
}

export function ExtensionTimeline({ extensions }: ExtensionTimelineProps) {
  if (extensions.length === 0) return null;

  return (
    <div className="space-y-3">
      {extensions.map((ext) => (
        <div key={ext.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            <div className="h-full w-px bg-border" />
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Extension #{ext.extensionNumber}
              </span>
              <ExtensionStatusBadge
                status={ext.status as "pending" | "approved" | "rejected" | "cancelled"}
              />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Requested end: {new Date(ext.requestedEndAt).toLocaleDateString()}
            </p>
            {ext.reason && (
              <p className="mt-1 text-sm text-muted-foreground">{ext.reason}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(ext.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
