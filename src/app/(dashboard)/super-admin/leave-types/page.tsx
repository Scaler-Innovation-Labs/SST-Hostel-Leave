"use client";

import { Eye, Plus, Save } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { DynamicFormBuilder } from "@/components/leaves/DynamicFormBuilder";
import { ErrorState } from "@/components/shared/ErrorState";
import { CATEGORY_COLORS } from "@/constants/leave/leave-category";
import { LEAVE_WORKFLOW_MODE } from "@/constants/leave/workflow-mode";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((r) => r.data ?? r);

type FormField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  minLength?: number;
  maxLength?: number;
};

type LeaveType = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  workflowMode: string;
  defaultWorkflowId: string | null;
  allowExtensions: boolean;
  maxExtensionCount: number | null;
  isActive: boolean;
  formSchema: { fields: Array<FormField> };
  policyConfig: Record<string, unknown> | null;
  version: number;
};

type Draft = {
  id?: string;
  code: string;
  name: string;
  category: string;
  description: string;
  workflowMode: string;
  defaultWorkflowId: string | null;
  allowExtensions: boolean;
  maxExtensionCount: string;
  isActive: boolean;
  isSpecial: boolean;
  formSchema: { fields: Array<FormField> };
};

const EMPTY_DRAFT: Draft = {
  code: "",
  name: "",
  category: "HOME_PASS",
  description: "",
  workflowMode: LEAVE_WORKFLOW_MODE.HOSTEL,
  defaultWorkflowId: null,
  allowExtensions: false,
  maxExtensionCount: "",
  isActive: true,
  isSpecial: false,
  formSchema: {
    fields: [
      { key: "destination", label: "Destination", type: "text", required: true, maxLength: 200 },
      { key: "reason", label: "Reason", type: "textarea", required: true, minLength: 10, maxLength: 500 },
    ],
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  HOME_PASS: "Home Pass",
  MEDICAL: "Medical",
  LOCAL_OUTING: "Local Outing",
  NIGHT_OUT: "Night Out",
  ACADEMIC: "Academic",
  HOSTEL: "Hostel",
};

export default function LeaveTypesPage() {
  const { data: workflowsResponse } = useSWR<{ items: Array<{ id: string; name: string; code: string }> }>(
    "/api/v1/workflows?limit=100",
    fetcher,
  );
  const workflows = workflowsResponse?.items ?? [];

  const { data: leaveTypes, isLoading, error, mutate } = useSWR<LeaveType[]>(
    "/api/v1/admin/leave-types",
    fetcher,
  );

  const isError = !!error;

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const edit = (lt: LeaveType) => {
    // Normalize: handle fields stored as array directly or { fields: [...] }
    const rawSchema: unknown = lt.formSchema;
    let rawFields: Array<Record<string, unknown>> = [];
    if (Array.isArray(rawSchema)) {
      rawFields = rawSchema;
    } else if (rawSchema && typeof rawSchema === "object" && Array.isArray((rawSchema as Record<string, unknown>).fields)) {
      rawFields = (rawSchema as Record<string, unknown>).fields as Array<Record<string, unknown>>;
    }

    const normalizedFields: FormField[] = rawFields.map((f, i) => ({
      key: (f.key as string) ?? `field_${i + 1}`,
      label: (f.label as string) ?? `Field ${i + 1}`,
      type: (f.type as string) || "text",
      required: (f.required as boolean) ?? false,
      placeholder: f.placeholder as string | undefined,
      options: f.options as string[] | undefined,
      minLength: f.minLength as number | undefined,
      maxLength: f.maxLength as number | undefined,
    }));

    const uiConfig = (lt as Record<string, unknown>).uiConfig as Record<string, unknown> | null ?? {};

    setDraft({
      id: lt.id,
      code: lt.code,
      name: lt.name,
      category: lt.category,
      description: lt.description ?? "",
      workflowMode: lt.workflowMode,
      defaultWorkflowId: lt.defaultWorkflowId,
      allowExtensions: lt.allowExtensions,
      maxExtensionCount: lt.maxExtensionCount != null ? String(lt.maxExtensionCount) : "",
      isActive: lt.isActive,
      isSpecial: (uiConfig.isSpecial as boolean) ?? false,
      formSchema: { fields: normalizedFields },
    });
    setMessage(null);
  };

  const startNew = () => {
    setDraft(EMPTY_DRAFT);
    setMessage(null);
  };

  const submit = async () => {
    if (!draft.name.trim() || !draft.code.trim()) {
      setMessage("Name and code are required.");
      return;
    }

    if (draft.formSchema.fields.length === 0) {
      setMessage("At least one form field is required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        ...draft,
        maxExtensionCount: draft.maxExtensionCount ? Number(draft.maxExtensionCount) : null,
        description: draft.description || null,
        uiConfig: { isSpecial: draft.isSpecial },
      };

      const url = draft.id
        ? `/api/v1/admin/leave-types/${draft.id}`
        : "/api/v1/admin/leave-types";

      const res = await fetch(url, {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? "Failed to save leave type");
      }

      await mutate();
      setDraft(EMPTY_DRAFT);
      setMessage("Leave type saved.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Failed to save leave type");
    } finally {
      setSaving(false);
    }
  };

  if (isError) {
    return (
      <ErrorState message={error?.message ?? "Failed to load leave types"} onRetry={() => mutate()} />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Types"
        description="Configure leave types with form schemas and workflow assignments."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        {/* Leave types list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Leave Types</h2>
            <Button variant="outline" onClick={startNew}>
              <Plus className="size-4" /> New
            </Button>
          </div>

          {isLoading ? (
            <LoadingState count={4} />
          ) : (
            leaveTypes?.map((lt) => {
              const ltUiConfig = (lt as Record<string, unknown>).uiConfig as Record<string, boolean> | null;
              const isSpecial = ltUiConfig?.isSpecial === true;

              return (
              <button
                key={lt.id}
                onClick={() => edit(lt)}
                className={`w-full rounded-xl border bg-card p-4 text-left transition-all hover:border-primary ${
                  draft.id === lt.id ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{lt.name}</span>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {lt.code} · v{lt.version}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[lt.category] ?? "bg-muted text-muted-foreground"}`}>
                      {CATEGORY_LABELS[lt.category] ?? lt.category}
                    </span>
                    {isSpecial && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800">
                        Special
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        lt.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {lt.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lt.formSchema.fields.length} form fields
                  {lt.allowExtensions ? ` · ${lt.maxExtensionCount ?? "?"} max extensions` : " · No extensions"}
                </p>
              </button>
              );
            })
          )}
        </section>

        {/* Editor */}
        <section className="space-y-6 rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">{draft.id ? "Edit Leave Type" : "New Leave Type"}</h3>

          {/* ── Section 1: Basic Information ── */}
          <div>
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Leave Type Information
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Home Pass"
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Code</span>
                <input
                  value={draft.code}
                  onChange={(e) =>
                    setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })
                  }
                  placeholder="HOME_PASS"
                  className="h-9 w-full rounded-lg border bg-background px-3 font-mono text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Category</span>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Status</span>
                <select
                  value={draft.isActive ? "active" : "inactive"}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.value === "active" })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <div />
            </div>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium">Description</span>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border bg-background p-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </label>

            <div className="mt-4 space-y-3 rounded-lg border bg-muted/10 p-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.allowExtensions}
                  onChange={(e) => setDraft({ ...draft, allowExtensions: e.target.checked })}
                  className="rounded"
                />
                Allow extensions
              </label>
              {draft.allowExtensions && (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Max extension count</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.maxExtensionCount}
                    onChange={(e) => setDraft({ ...draft, maxExtensionCount: e.target.value })}
                    className="h-9 w-32 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                  />
                </label>
              )}
            </div>

            <div className="mt-4 space-y-3 rounded-lg border bg-muted/10 p-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isSpecial}
                  onChange={(e) => setDraft({ ...draft, isSpecial: e.target.checked })}
                  className="rounded"
                />
                <span>
                  Mark as <strong>Special leave</strong>
                </span>
              </label>
              {draft.isSpecial && (
                <p className="text-xs text-muted-foreground">
                  Admin will be required to confirm document verification before approving this leave type.
                </p>
              )}
            </div>
          </div>

          {/* ── Section 2: Workflow Configuration ── */}
          <div>
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Workflow Configuration
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Workflow Mode</span>
                <select
                  value={draft.workflowMode}
                  onChange={(e) => setDraft({ ...draft, workflowMode: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  <option value={LEAVE_WORKFLOW_MODE.HOSTEL}>Hostel Default</option>
                  <option value={LEAVE_WORKFLOW_MODE.ACADEMIC}>Leave-Type Specific</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Default Workflow</span>
                <select
                  value={draft.defaultWorkflowId ?? ""}
                  onChange={(e) => setDraft({ ...draft, defaultWorkflowId: e.target.value || null })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  <option value="">No default</option>
                  {workflows?.map((wf) => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name} ({wf.code})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* ── Section 3: Dynamic Form Builder ── */}
          <div>
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Form Builder
            </p>
            <div className="rounded-lg border bg-muted/10 p-4">
              <DynamicFormBuilder
                schema={draft.formSchema as { fields: Array<{ key: string; label: string; type: string; required?: boolean; placeholder?: string; options?: string[]; minLength?: number; maxLength?: number }> }}
                onChange={(schema) => setDraft({ ...draft, formSchema: schema as { fields: Array<FormField> } })}
              />
            </div>
          </div>

          {/* ── Section 5: Preview ── */}
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Eye className="size-3" />
              Student Preview
            </p>
            <div className="rounded-lg border bg-background p-4">
              {draft.formSchema.fields.length === 0 ? (
                <p className="text-xs text-muted-foreground">No form fields configured.</p>
              ) : (
                <div className="space-y-3">
                  {draft.formSchema.fields.map((field) => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        {field.label}
                        {field.required && <span className="ml-0.5 text-destructive">*</span>}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          readOnly
                          placeholder={field.placeholder ?? `Enter ${(field.label ?? '').toLowerCase()}...`}
                          className="w-full rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground outline-none"
                          rows={3}
                        />
                      ) : field.type === "select" ? (
                        <select
                          disabled
                          className="h-8 w-full rounded-md border bg-muted/30 px-3 text-xs text-muted-foreground outline-none"
                        >
                          <option>{field.placeholder ?? `Select ${(field.label ?? '').toLowerCase()}...`}</option>
                          {field.options?.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          readOnly
                          placeholder={field.placeholder ?? `Enter ${(field.label ?? '').toLowerCase()}...`}
                          className="h-8 w-full rounded-md border bg-muted/30 px-3 text-xs text-muted-foreground outline-none"
                        />
                      )}
                      {field.minLength != null && field.maxLength != null && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {field.minLength}–{field.maxLength} characters
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active toggle */}
          {message && (
            <p
              className={`text-sm ${
                message === "Leave type saved." ? "text-green-600" : "text-muted-foreground"
              }`}
            >
              {message}
            </p>
          )}

          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={submit} disabled={saving || !draft.name.trim() || !draft.code.trim()}>
              <Save className="size-4" />
              {saving ? "Saving..." : draft.id ? "Update leave type" : "Create leave type"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
