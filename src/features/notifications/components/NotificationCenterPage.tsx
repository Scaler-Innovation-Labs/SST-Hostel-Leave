"use client";

import { Bell, CheckCheck, Clock } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { getEventColor, getEventLabel } from "@/constants/notification/notification-labels";
import { useNotificationStream } from "@/features/notifications/hooks/use-notification-stream";
import { markNotificationsRead, useNotifications } from "@/features/notifications/hooks/use-notifications";
import { formatRelative } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "unread" | "sent" | "failed";

export function NotificationCenterPage() {
  const [page, setPage] = useState(1);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const { notifications, isLoading, isError, error, mutate } = useNotifications(page, 20);
  const { connected } = useNotificationStream();

  const filtered =
    filterTab === "all"
      ? notifications.items
      : filterTab === "unread"
      ? notifications.items.filter((n) => !n.readAt)
      : filterTab === "sent"
      ? notifications.items.filter((n) => n.deliveryStatus === "SENT")
      : notifications.items.filter((n) => n.deliveryStatus === "FAILED");

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.items
      .filter((n) => !n.readAt)
      .map((n) => n.id);
    if (unreadIds.length > 0) {
      await markNotificationsRead(unreadIds);
      await mutate();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="System notifications and updates"
        action={
          <div className="flex items-center gap-3">
            {connected && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Live
              </span>
            )}
            {notifications.unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                className="gap-2"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(["all", "unread", "sent", "failed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setFilterTab(tab);
              setPage(1);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              filterTab === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab === "all"
              ? "All"
              : tab === "unread"
              ? "Unread"
              : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <div className="ml-auto">
          {notifications.unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {notifications.unreadCount} unread
            </span>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <LoadingState count={5} />
      ) : isError ? (
        <ErrorState message={error?.message ?? "Failed to load notifications"} onRetry={() => mutate()} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No notifications</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            {filterTab !== "all" ? "Try a different filter." : "New notifications will appear here."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {filtered.map((n) => {
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-4 px-5 py-4 transition-colors",
                  isUnread && "bg-muted/30",
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                    getEventColor(n.eventType),
                  )}
                >
                  {n.deliveryStatus === "FAILED" ? (
                    <span className="text-destructive">!</span>
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm",
                        isUnread ? "font-semibold" : "font-medium text-muted-foreground",
                      )}
                    >
                      {getEventLabel(n.eventType)}
                    </span>
                    {isUnread && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelative(n.createdAt)}
                    </span>
                    <span>via {n.channel}</span>
                    {n.deliveryStatus === "FAILED" && (
                      <span className="text-destructive">Delivery failed</span>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatRelative(n.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {notifications.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Page {notifications.page} of {notifications.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={notifications.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={notifications.page >= notifications.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
