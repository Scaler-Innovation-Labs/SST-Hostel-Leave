"use client";

import { useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_EVENTS } from "@/constants/notification/notification-event";
import { EVENT_LABELS } from "@/constants/notification/notification-labels";
import { NOTIFICATION_CHANNELS } from "@/constants/notification/notification-channel";
import {
  useNotificationTemplates,
  createTemplate,
  deleteTemplate,
  toggleTemplateActive,
} from "@/features/notifications/hooks/use-notification-templates";

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  PUSH: "In-App",
  WEBHOOK: "Webhook",
  SLACK: "Slack",
};

const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-500/10 text-blue-600",
  SMS: "bg-emerald-500/10 text-emerald-600",
  PUSH: "bg-violet-500/10 text-violet-600",
  WEBHOOK: "bg-amber-500/10 text-amber-600",
  SLACK: "bg-rose-500/10 text-rose-600",
};

export default function NotificationTemplatesPage() {
  const { templates, isLoading, isError, mutate } = useNotificationTemplates();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    code: string;
    eventKey: string;
    channel: string;
    subject: string;
    templateBody: string;
    isActive: boolean;
  }>({
    code: "",
    eventKey: NOTIFICATION_EVENTS[0] ?? "LEAVE_SUBMITTED",
    channel: "EMAIL",
    subject: "",
    templateBody: "",
    isActive: true,
  });

  const handleCreate = async () => {
    if (!form.code || !form.templateBody) return;
    setSaving(true);
    try {
      await createTemplate({
        code: form.code,
        eventKey: form.eventKey,
        channel: form.channel,
        subject: form.subject || null,
        templateBody: form.templateBody,
        isActive: form.isActive,
      });
      setForm({
        code: "",
        eventKey: NOTIFICATION_EVENTS[0] ?? "LEAVE_SUBMITTED",
        channel: "EMAIL",
        subject: "",
        templateBody: "",
        isActive: true,
      });
      setShowForm(false);
      await mutate();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await toggleTemplateActive(id, !current);
      await mutate();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this notification template?")) return;
    try {
      await deleteTemplate(id);
      await mutate();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Templates"
        description="Manage message templates for all notification channels."
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "New Template"}
        </Button>
      </div>

      {showForm && (
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">New Template</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Code</span>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                placeholder="leave_submitted_email"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Event</span>
              <select
                value={form.eventKey}
                onChange={(e) => setForm({ ...form, eventKey: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs"
              >
                {NOTIFICATION_EVENTS.map((ev) => (
                  <option key={ev} value={ev}>{EVENT_LABELS[ev] ?? ev}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Channel</span>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs"
              >
                {NOTIFICATION_CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>{CHANNEL_LABELS[ch] ?? ch}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Subject</span>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                placeholder="Optional email subject"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Template Body</span>
            <textarea
              value={form.templateBody}
              onChange={(e) => setForm({ ...form, templateBody: e.target.value })}
              className="min-h-[120px] w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-ring"
              placeholder="Enter template content with {{variables}}"
              rows={6}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
          <Button onClick={handleCreate} disabled={!form.code || !form.templateBody || saving}>
            {saving ? "Creating..." : "Create Template"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <LoadingState count={6} />
      ) : isError ? (
        <ErrorState message="Failed to load templates" onRetry={() => mutate()} />
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card p-12">
          <p className="text-sm text-muted-foreground">No notification templates configured.</p>
          <p className="text-xs text-muted-foreground">Create your first template to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {templates.map((tpl) => (
                <tr key={tpl.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{tpl.code}</td>
                  <td className="px-4 py-3 text-xs">{EVENT_LABELS[tpl.eventKey] ?? tpl.eventKey}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${CHANNEL_COLORS[tpl.channel] ?? "bg-muted text-muted-foreground"}`}>
                      {CHANNEL_LABELS[tpl.channel] ?? tpl.channel}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground">
                    {tpl.subject ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(tpl.id, tpl.isActive)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        tpl.isActive
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tpl.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(tpl.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
