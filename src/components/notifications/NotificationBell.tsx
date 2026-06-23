"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getEventLabel } from "@/constants/notification/notification-labels";
import { useNotificationStream } from "@/features/notifications/hooks/use-notification-stream";
import { useNotificationToast } from "@/features/notifications/hooks/use-notification-toast";
import { markNotificationsRead, useNotifications } from "@/features/notifications/hooks/use-notifications";

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { notifications, isLoading, mutate } = useNotifications(1, 5);
  const { lastEvent } = useNotificationStream();
  const prevEventRef = useRef(lastEvent);

  // Show toasts for incoming SSE events
  useNotificationToast();

  // Refetch when SSE event arrives
  useEffect(() => {
    if (
      lastEvent &&
      lastEvent.type === "approvals_update" &&
      lastEvent !== prevEventRef.current
    ) {
      prevEventRef.current = lastEvent;
      mutate();
    }
  }, [lastEvent, mutate]);

  const unreadCount = notifications.unreadCount;

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen && unreadCount > 0) {
        // Mark visible unread notifications as read using readAt field
        const ids = notifications.items
          .filter((n) => !n.readAt)
          .map((n) => n.id);
        if (ids.length > 0) {
          markNotificationsRead(ids).then(() => mutate());
        }
      }
    },
    [unreadCount, notifications.items, mutate],
  );

  const handleViewAll = () => {
    setOpen(false);
    router.push("/notifications");
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className="
            relative flex items-center justify-center
            rounded-xl p-2
            text-muted-foreground
            transition-colors
            hover:bg-accent hover:text-foreground
          "
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 4 9 4 9H2s4-2 4-9" />
            <path d="M9.5 22c.9 1 2.5 1 3.5 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
              {unreadCount} unread
            </span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="size-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
          </div>
        ) : notifications.items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.items.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex flex-col items-start gap-0.5 px-4 py-3 ${
                  notification.deliveryStatus === "SENT"
                    ? "bg-muted/30 font-medium"
                    : ""
                }`}
              >
                <span className="text-sm">
                  {getEventLabel(notification.eventType)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(notification.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleViewAll}
          className="cursor-pointer justify-center text-sm font-medium text-primary"
        >
          View All Notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
