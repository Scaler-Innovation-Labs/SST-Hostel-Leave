"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_CHANNELS } from "@/constants/notification/notification-channel";
import { NOTIFICATION_EVENTS } from "@/constants/notification/notification-event";
import { EVENT_LABELS } from "@/constants/notification/notification-labels";
import {
  createTemplate,
  deleteTemplate,
  updateTemplate,
  useNotificationTemplates,
  type NotificationTemplate,
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

type TemplateDraft = {
  id?: string;
  code: string;
  eventKey: string;
  channel: string;
  subject: string;
  templateBody: string;
  isActive: boolean;
};

const EMPTY_DRAFT: TemplateDraft = {
  code: "",
  eventKey: NOTIFICATION_EVENTS[0] ?? "LEAVE_SUBMITTED",
  channel: "EMAIL",
  subject: "",
  templateBody: "",
  isActive: true,
};

export default function NotificationTemplatesPage() {
  const { templates, isLoading, isError, mutate } = useNotificationTemplates();
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY_DRAFT);

  const startNew = () => {
    setDraft(EMPTY_DRAFT);
  };

  const editTemplate = (tpl: NotificationTemplate) => {
    setDraft({
      id: tpl.id,
      code: tpl.code,
      eventKey: tpl.eventKey,
      channel: tpl.channel,
      subject: tpl.subject ?? "",
      templateBody: tpl.templateBody,
      isActive: tpl.isActive,
    });
  };

  const handleSave = async () => {
    if (!draft.code || !draft.templateBody) return;
    setSaving(draft.id ?? "new");
    try {
      if (draft.id) {
        const updated = await updateTemplate(draft.id, {
          eventKey: draft.eventKey,
          channel: draft.channel,
          subject: draft.subject || null,
          templateBody: draft.templateBody,
          isActive: draft.isActive,
        });
        setDraft({
          id: updated.id,
          code: updated.code,
          eventKey: updated.eventKey,
          channel: updated.channel,
          subject: updated.subject ?? "",
          templateBody: updated.templateBody,
          isActive: updated.isActive,
        });
        await mutate();
      } else {
        await createTemplate({
          code: draft.code,
          eventKey: draft.eventKey,
          channel: draft.channel,
          subject: draft.subject || null,
          templateBody: draft.templateBody,
          isActive: draft.isActive,
        });
        setDraft(EMPTY_DRAFT);
        await mutate();
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this notification template?")) return;
    try {
      await deleteTemplate(id);
      if (draft.id === id) setDraft(EMPTY_DRAFT);
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

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Templates</h2>
            <Button variant="outline" onClick={startNew}>
              <Plus className="size-4" /> Add Template
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card p-12">
              <p className="text-sm text-muted-foreground">Failed to load templates.</p>
              <Button variant="outline" onClick={() => mutate()}>Retry</Button>
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notification templates configured.
            </p>
          ) : (
            templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => editTemplate(tpl)}
                className={`w-full rounded-xl border bg-card p-4 text-left hover:border-primary ${
                  draft.id === tpl.id ? "border-primary" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{tpl.code}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span
                        className="rounded-full bg-muted px-2 py-0.5 text-xs"
                      >
                        {EVENT_LABELS[tpl.eventKey] ?? tpl.eventKey}
                      </span>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${CHANNEL_COLORS[tpl.channel] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {CHANNEL_LABELS[tpl.channel] ?? tpl.channel}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      tpl.isActive
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tpl.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </button>
            ))
          )}
        </section>

        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">
            {draft.id ? "Edit Template" : "New Template"}
          </h2>

          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Code</span>
              <input
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                placeholder="leave_submitted_email"
                readOnly={!!draft.id}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Event</span>
                <select
                  value={draft.eventKey}
                  onChange={(e) => setDraft({ ...draft, eventKey: e.target.value })}
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
                  value={draft.channel}
                  onChange={(e) => setDraft({ ...draft, channel: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-xs"
                >
                  {NOTIFICATION_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>{CHANNEL_LABELS[ch] ?? ch}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Subject</span>
              <input
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                placeholder="Optional email subject line"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Template Body</span>
              <textarea
                value={draft.templateBody}
                onChange={(e) => setDraft({ ...draft, templateBody: e.target.value })}
                className="min-h-[200px] w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-ring"
                placeholder="Enter template content with {{variables}}"
                rows={8}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={!draft.code || !draft.templateBody || saving !== null}
            >
              <Save className="size-4" />
              {saving === (draft.id ?? "new") ? "Saving..." : "Save Template"}
            </Button>
            {draft.id && (
              <Button
                variant="destructive"
                onClick={() => handleDelete(draft.id!)}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
