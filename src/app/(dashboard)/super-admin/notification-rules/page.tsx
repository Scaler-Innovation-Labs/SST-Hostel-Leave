"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_CHANNELS } from "@/constants/notification/notification-channel";
import { NOTIFICATION_EVENTS } from "@/constants/notification/notification-event";
import { EVENT_LABELS } from "@/constants/notification/notification-labels";
import { NOTIFICATION_RECIPIENT_TYPES } from "@/constants/notification/notification-recipient-type";
import { useNotificationTemplates } from "@/features/notifications/hooks/use-notification-templates";
import {
  createRule,
  deleteRule,
  fetchGlobalRules,
  type NotificationRuleResponse,
  updateRule,
} from "@/lib/api/notification-rule-api";

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  PUSH: "In-App",
  WEBHOOK: "Webhook",
  SLACK: "Slack",
};

const RECIPIENT_LABELS: Record<string, string> = {
  STUDENT: "Student",
  PARENT: "Parent",
  CURRENT_APPROVER: "Current Approver",
  PREVIOUS_APPROVER: "Previous Approver",
  ALL_APPROVERS: "All Approvers",
  WARDEN: "Warden",
  POC: "POC",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

type RuleDraft = {
  id?: string;
  eventType: string;
  templateId: string;
  enabled: boolean;
  recipientTypes: string[];
  channels: string[];
  customRecipients: Array<{ type: string; value: string }>;
};

const EMPTY_RULE: RuleDraft = {
  eventType: NOTIFICATION_EVENTS[0]!,
  templateId: "",
  enabled: true,
  recipientTypes: ["STUDENT"],
  channels: ["EMAIL"],
  customRecipients: [],
};

export default function NotificationRulesPage() {
  const { templates } = useNotificationTemplates();
  const [rules, setRules] = useState<NotificationRuleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_RULE);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await fetchGlobalRules();
      setRules(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const startNew = () => {
    setDraft(EMPTY_RULE);
  };

  const editRule = (rule: NotificationRuleResponse) => {
    setDraft({
      id: rule.id,
      eventType: rule.eventType,
      templateId: rule.templateId,
      enabled: rule.enabled,
      recipientTypes: rule.recipientTypes,
      channels: rule.channels,
      customRecipients: rule.customRecipients,
    });
  };

  const handleSave = async () => {
    if (!draft.templateId) return;
    setSaving(draft.id ?? "new");
    try {
      if (draft.id) {
        const updated = await updateRule(draft.id, {
          eventType: draft.eventType,
          templateId: draft.templateId,
          enabled: draft.enabled,
          recipientTypes: draft.recipientTypes,
          channels: draft.channels,
          customRecipients: draft.customRecipients as never,
        });
        setRules((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
      } else {
        const created = await createRule({
          eventType: draft.eventType,
          templateId: draft.templateId,
          enabled: draft.enabled,
          recipientTypes: draft.recipientTypes,
          channels: draft.channels,
          customRecipients: draft.customRecipients as never,
        });
        setRules((prev) => [...prev, created]);
      }
      setDraft(EMPTY_RULE);
    } catch {
      /* ignore */
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this notification rule?")) return;
    try {
      await deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      /* ignore */
    }
  };

  const toggleRecipient = (rt: string) => {
    setDraft((prev) => ({
      ...prev,
      recipientTypes: prev.recipientTypes.includes(rt)
        ? prev.recipientTypes.filter((r) => r !== rt)
        : [...prev.recipientTypes, rt],
    }));
  };

  const toggleChannel = (ch: string) => {
    setDraft((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter((c) => c !== ch)
        : [...prev.channels, ch],
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Rules"
        description="Configure event-driven notification delivery rules."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Global Rules</h2>
            <Button variant="outline" onClick={startNew}>
              <Plus className="size-4" /> Add Rule
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No global notification rules configured.
            </p>
          ) : (
            rules.map((rule) => (
              <button
                key={rule.id}
                onClick={() => editRule(rule)}
                className="w-full rounded-xl border bg-card p-4 text-left hover:border-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium">
                      {EVENT_LABELS[rule.eventType] ?? rule.eventType}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {rule.recipientTypes.map((rt) => (
                        <span
                          key={rt}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs"
                        >
                          {RECIPIENT_LABELS[rt] ?? rt}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {rule.channels.map((ch) => (
                        <span
                          key={ch}
                          className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                        >
                          {CHANNEL_LABELS[ch] ?? ch}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {rule.templateCode}
                  </span>
                </div>
              </button>
            ))
          )}
        </section>

        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">
            {draft.id ? "Edit Rule" : "New Rule"}
          </h2>

          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Event</span>
              <select
                value={draft.eventType}
                onChange={(e) =>
                  setDraft({ ...draft, eventType: e.target.value })
                }
                className="h-9 w-full rounded-lg border bg-background px-3"
              >
                {NOTIFICATION_EVENTS.map((ev) => (
                  <option key={ev} value={ev}>
                    {EVENT_LABELS[ev] ?? ev}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Template</span>
              <select
                value={draft.templateId}
                onChange={(e) =>
                  setDraft({ ...draft, templateId: e.target.value })
                }
                className="h-9 w-full rounded-lg border bg-background px-3"
              >
                <option value="">Select a template...</option>
                {templates
                  .filter((t) => t.eventKey === draft.eventType)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code ?? t.eventKey} ({t.channel})
                    </option>
                  ))}
              </select>
            </label>

            <div className="text-sm">
              <span className="mb-2 block font-medium">Recipients</span>
              <div className="flex flex-wrap gap-2">
                {NOTIFICATION_RECIPIENT_TYPES.map((rt) => (
                  <label
                    key={rt}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                      draft.recipientTypes.includes(rt)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={draft.recipientTypes.includes(rt)}
                      onChange={() => toggleRecipient(rt)}
                    />
                    {RECIPIENT_LABELS[rt] ?? rt}
                  </label>
                ))}
              </div>
            </div>

            <div className="text-sm">
              <span className="mb-2 block font-medium">Channels</span>
              <div className="flex flex-wrap gap-2">
                {NOTIFICATION_CHANNELS.map((ch) => (
                  <label
                    key={ch}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                      draft.channels.includes(ch)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={draft.channels.includes(ch)}
                      onChange={() => toggleChannel(ch)}
                    />
                    {CHANNEL_LABELS[ch] ?? ch}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft({ ...draft, enabled: e.target.checked })
                }
              />
              Enabled
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={!draft.templateId || saving !== null}
            >
              <Save className="size-4" />
              {saving === (draft.id ?? "new") ? "Saving..." : "Save Rule"}
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
