"use client";

import { useState } from "react";
import useSWR from "swr";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_CHANNELS } from "@/constants/notification/notification-channel";
import { NOTIFICATION_DELIVERY_STATUSES } from "@/constants/notification/notification-delivery-status";
import { NOTIFICATION_EVENTS } from "@/constants/notification/notification-event";
import { getEventColor,getEventLabel } from "@/constants/notification/notification-labels";
import type { NotificationLog } from "@/db/repositories/notification/notification-log.repository";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((r) => r.data ?? r);

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  PUSH: "In-App",
  WEBHOOK: "Webhook",
  SLACK: "Slack",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  FAILED: "Failed",
  DELIVERED: "Delivered",
  READ: "Read",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  SENT: "bg-blue-500/10 text-blue-600",
  FAILED: "bg-destructive/10 text-destructive",
  DELIVERED: "bg-emerald-500/10 text-emerald-600",
  READ: "bg-violet-500/10 text-violet-600",
};

export default function DeliveryLogsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    eventType: string;
    channel: string;
    status: string;
  }>({ eventType: "", channel: "", status: "" });

  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (filters.eventType) params.set("eventType", filters.eventType);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.status) params.set("status", filters.status);

  const { data, isLoading, error, mutate } = useSWR<{
    items: NotificationLog[];
    total: number;
    page: number;
    totalPages: number;
  }>(`/api/v1/admin/notification-logs?${params.toString()}`, fetcher);

  const handleRefresh = () => mutate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Logs"
        description="View notification delivery status across all channels and events."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
        <select
          value={filters.eventType}
          onChange={(e) => { setFilters((f) => ({ ...f, eventType: e.target.value })); setPage(1); }}
          className="h-8 rounded-lg border bg-background px-2.5 text-xs outline-none focus:border-ring"
        >
          <option value="">All events</option>
          {NOTIFICATION_EVENTS.map((ev) => (
            <option key={ev} value={ev}>{getEventLabel(ev)}</option>
          ))}
        </select>

        <select
          value={filters.channel}
          onChange={(e) => { setFilters((f) => ({ ...f, channel: e.target.value })); setPage(1); }}
          className="h-8 rounded-lg border bg-background px-2.5 text-xs outline-none focus:border-ring"
        >
          <option value="">All channels</option>
          {NOTIFICATION_CHANNELS.map((ch) => (
            <option key={ch} value={ch}>{CHANNEL_LABELS[ch] ?? ch}</option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
          className="h-8 rounded-lg border bg-background px-2.5 text-xs outline-none focus:border-ring"
        >
          <option value="">All statuses</option>
          {NOTIFICATION_DELIVERY_STATUSES.map((st) => (
            <option key={st} value={st}>{STATUS_LABELS[st] ?? st}</option>
          ))}
        </select>

        <Button variant="outline" size="sm" onClick={handleRefresh}>
          Refresh
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingState count={8} />
      ) : error ? (
        <ErrorState message="Failed to load delivery logs" onRetry={() => mutate()} />
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card p-12">
          <p className="text-sm text-muted-foreground">No delivery logs found.</p>
          <p className="text-xs text-muted-foreground">
            Notifications will appear here once they are sent.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Provider ID</th>
                  <th className="px-4 py-3 font-medium">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.items.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs font-medium">
                      {log.recipient}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${getEventColor(log.eventType)}`}>
                        {getEventLabel(log.eventType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {CHANNEL_LABELS[log.channel] ?? log.channel}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[log.deliveryStatus] ?? ""}`}>
                        {STATUS_LABELS[log.deliveryStatus] ?? log.deliveryStatus}
                      </span>
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-3 font-mono text-[10px] text-muted-foreground">
                      {log.providerMessageId ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[10px] text-muted-foreground">
                      {log.providerResponse ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-xs text-muted-foreground">
                {data.total} total log{data.total !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="flex items-center text-xs text-muted-foreground">
                  Page {data.page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
