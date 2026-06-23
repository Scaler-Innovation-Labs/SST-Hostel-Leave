"use client";

import useSWR from "swr";

const NOTIFICATIONS_URL = "/api/v1/notifications";

export type NotificationItem = {
  id: string;
  eventType: string;
  channel: string;
  recipient: string;
  deliveryStatus: string;
  readAt: string | null;
  createdAt: string;
  leaveRequestId: string | null;
  metadata: Record<string, unknown> | null;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function useNotifications(page = 1, limit = 20) {
  const { data, error, isLoading, mutate } = useSWR<{ data: NotificationsResponse }>(
    `${NOTIFICATIONS_URL}?page=${page}&limit=${limit}`,
  );

  return {
    notifications: data?.data ?? {
      items: [],
      total: 0,
      unreadCount: 0,
      page,
      limit,
      totalPages: 0,
    },
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useUnreadCount() {
  const { data, error, isLoading } = useSWR<{ data: NotificationsResponse }>(`${NOTIFICATIONS_URL}?page=1&limit=1`, {
    refreshInterval: 30_000,
  });

  return {
    unreadCount: data?.data?.unreadCount ?? 0,
    isLoading,
    isError: !!error,
  };
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  await fetch("/api/v1/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}
