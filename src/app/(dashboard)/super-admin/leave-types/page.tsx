"use client";

import { Eye, Plus, QrCode, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { DynamicFormBuilder } from "@/components/leaves/DynamicFormBuilder";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { LEAVE_TYPE_COLOR_PALETTE } from "@/constants/leave/leave-category";
import { QR_MODE, QR_MODES } from "@/constants/leave/qr-mode";
import { LEAVE_WORKFLOW_MODE } from "@/constants/leave/workflow-mode";
import { fetcher } from "@/lib/api/fetcher";

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

type RequiredDocument = {
  code: string;
  label: string;
  required: boolean;
  acceptedTypes?: string[];
};

type LeaveType = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  workflowMode: string;
  defaultWorkflowId: string | null;
  qrMode: string;
  allowExtensions: boolean;
  maxExtensionCount: number | null;
  isActive: boolean;
  formSchema: { fields: Array<FormField> };
  requiredDocuments: RequiredDocument[] | { documents: RequiredDocument[] } | null;
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
  qrMode: string;
  allowExtensions: boolean;
  maxExtensionCount: string;
  isActive: boolean;
  isSpecial: boolean;
  color: string;
  formSchema: { fields: Array<FormField> };
  requiredDocuments: Array<RequiredDocument>;
};

const EMPTY_DRAFT: Draft = {
  code: "",
  name: "",
  category: "HOME_PASS",
  description: "",
  workflowMode: LEAVE_WORKFLOW_MODE.HOSTEL,
  defaultWorkflowId: null,
  qrMode: QR_MODE.BOTH,
  allowExtensions: false,
  maxExtensionCount: "",
  isActive: true,
  isSpecial: false,
  color: LEAVE_TYPE_COLOR_PALETTE[0],
  formSchema: {
    fields: [
      { key: "destination", label: "Destination", type: "text", required: true, maxLength: 200 },
      { key: "reason", label: "Reason", type: "textarea", required: true, minLength: 10, maxLength: 500 },
    ],
  },
  requiredDocuments: [],
};

const CATEGORY_LABELS: Record<string, string> = {
  HOME_PASS: "Home Pass",
  MEDICAL: "Medical",
  LOCAL_OUTING: "Local Outing",
  NIGHT_OUT: "Night Out",
  ACADEMIC: "Academic",
  HOSTEL: "Hostel",
};

const QR_MODE_LABELS: Record<string, string> = {
  [QR_MODE.NONE]: "No QR",
  [QR_MODE.EXIT_ONLY]: "Exit only",
  [QR_MODE.RETURN_ONLY]: "Return only",
  [QR_MODE.BOTH]: "Exit + Return",
  [QR_MODE.OPTIONAL]: "Optional",
};

const QR_MODE_DESCRIPTIONS: Record<string, string> = {
  [QR_MODE.NONE]: "No QR pass is issued. The leave grants permission only, with no gate movement.",
  [QR_MODE.EXIT_ONLY]: "A QR pass is issued for exiting campus. No return scan is required.",
  [QR_MODE.RETURN_ONLY]: "A QR pass is issued for returning to campus. No exit scan is required.",
  [QR_MODE.BOTH]: "QR passes cover both exit and return scans at the gate.",
  [QR_MODE.OPTIONAL]: "A QR pass may be issued, but gate scans are not strictly enforced.",
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

    const rawDocuments = Array.isArray(lt.requiredDocuments)
      ? lt.requiredDocuments
      : lt.requiredDocuments?.documents ?? [];
    const normalizedDocuments: RequiredDocument[] = rawDocuments.map((document) => ({
      code: document.code ?? "",
      label: document.label ?? "",
      required: document.required ?? true,
      acceptedTypes: document.acceptedTypes ?? [],
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
      qrMode: lt.qrMode ?? QR_MODE.BOTH,
      allowExtensions: lt.allowExtensions,
      maxExtensionCount: lt.maxExtensionCount != null ? String(lt.maxExtensionCount) : "",
      isActive: lt.isActive,
      isSpecial: (uiConfig.isSpecial as boolean) ?? false,
      color: typeof uiConfig.color === "string" ? uiConfig.color : LEAVE_TYPE_COLOR_PALETTE[0],
      formSchema: { fields: normalizedFields },
      requiredDocuments: normalizedDocuments,
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
        requiredDocuments: draft.requiredDocuments,
        uiConfig: { isSpecial: draft.isSpecial, color: draft.color },
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
              const ltUiConfig = (lt as Record<string, unknown>).uiConfig as Record<string, boolean | string> | null;
              const isSpecial = ltUiConfig?.isSpecial === true;
              const color = typeof ltUiConfig?.color === "string" ? ltUiConfig.color : null;

              return (
              <button
                key={lt.id}
                onClick={() => edit(lt)}
                className={`w-full rounded-xl border bg-surface p-4 text-left transition-all hover:border-accent ${
                  draft.id === lt.id ? "border-accent ring-1 ring-accent" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      {color && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      )}
                      {lt.name}
                    </span>
                    <p className="mt-0.5 font-mono text-caption text-muted">
                      {lt.code} · v{lt.version}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-sm border border-border bg-surface-sunken px-1.5 py-0.5 text-micro font-medium text-muted">
                      {CATEGORY_LABELS[lt.category] ?? lt.category}
                    </span>
                    {isSpecial && (
                      <span className="rounded-sm bg-warning-light px-2 py-0.5 text-micro font-medium text-warning">
                        Special
                      </span>
                    )}
                    <span
                      className={`rounded-sm px-2 py-0.5 text-micro font-medium ${
                        lt.isActive
                          ? "bg-success-light text-success"
                          : "bg-surface-sunken text-muted"
                      }`}
                    >
                      {lt.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-caption text-muted">
                  {lt.formSchema.fields.length} form fields
                  {lt.allowExtensions ? ` · ${lt.maxExtensionCount ?? "?"} max extensions` : " · No extensions"}
                  {` · QR: ${QR_MODE_LABELS[lt.qrMode] ?? lt.qrMode ?? QR_MODE_LABELS[QR_MODE.BOTH]}`}
                </p>
              </button>
              );
            })
          )}
        </section>

        {/* Editor */}
        <section className="space-y-6 rounded-2xl border bg-surface p-5">
          <h3 className="font-semibold">{draft.id ? "Edit Leave Type" : "New Leave Type"}</h3>

          {/* ── Section 1: Basic Information ── */}
          <div>
            <p className="mb-3 text-caption font-medium text-muted uppercase tracking-wider">
              Leave Type Information
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-body">
                <span className="mb-1 block font-medium">Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Home Pass"
                  className="h-9 w-full rounded-lg border bg-bg px-3 text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </label>
              <label className="block text-body">
                <span className="mb-1 block font-medium">Code</span>
                <input
                  value={draft.code}
                  onChange={(e) =>
                    setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })
                  }
                  placeholder="HOME_PASS"
                  className="h-9 w-full rounded-lg border bg-bg px-3 font-mono text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="block text-body">
                <span className="mb-1 block font-medium">Category</span>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-bg px-3 text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-body">
                <span className="mb-1 block font-medium">Status</span>
                <select
                  value={draft.isActive ? "active" : "inactive"}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.value === "active" })}
                  className="h-9 w-full rounded-lg border bg-bg px-3 text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <div />
            </div>

            <label className="mt-4 block text-body">
              <span className="mb-1 block font-medium">Description</span>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border bg-bg p-2 text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </label>

            <div className="mt-4 space-y-3 rounded-lg border bg-surface-sunken/10 p-4">
              <label className="flex items-center gap-2 text-body">
                <input
                  type="checkbox"
                  checked={draft.allowExtensions}
                  onChange={(e) => setDraft({ ...draft, allowExtensions: e.target.checked })}
                  className="rounded"
                />
                Allow extensions
              </label>
              {draft.allowExtensions && (
                <label className="block text-body">
                  <span className="mb-1 block font-medium">Max extension count</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.maxExtensionCount}
                    onChange={(e) => setDraft({ ...draft, maxExtensionCount: e.target.value })}
                    className="h-9 w-32 rounded-lg border bg-bg px-3 text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </label>
              )}
            </div>

            <div className="mt-4 space-y-3 rounded-lg border bg-surface-sunken/10 p-4">
              <label className="flex items-center gap-2 text-body">
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
                <p className="text-caption text-muted">
                  Admin will be required to confirm document verification before approving this leave type.
                </p>
              )}
            </div>

            <div className="mt-4 space-y-3 rounded-lg border bg-surface-sunken/10 p-4">
              <label className="block text-body">
                <span className="mb-2 block font-medium">Color</span>
                <span className="flex flex-wrap items-center gap-2">
                  {LEAVE_TYPE_COLOR_PALETTE.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={`Select color ${swatch}`}
                      onClick={() => setDraft({ ...draft, color: swatch })}
                      className={`h-6 w-6 rounded-full border-2 transition-colors duration-fast ease-standard ${
                        draft.color === swatch ? "border-accent ring-2 ring-accent/30" : "border-transparent"
                      }`}
                      style={{ backgroundColor: swatch }}
                    />
                  ))}
                </span>
              </label>
            </div>
          </div>

          {/* ── Section 2: Workflow Configuration ── */}
          <div>
            <p className="mb-3 text-caption font-medium text-muted uppercase tracking-wider">
              Workflow Configuration
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-body">
                <span className="mb-1 block font-medium">Workflow Mode</span>
                <select
                  value={draft.workflowMode}
                  onChange={(e) => setDraft({ ...draft, workflowMode: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-bg px-3 text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value={LEAVE_WORKFLOW_MODE.HOSTEL}>Hostel Default</option>
                  <option value={LEAVE_WORKFLOW_MODE.ACADEMIC}>Leave-Type Specific</option>
                </select>
              </label>
              <label className="block text-body">
                <span className="mb-1 block font-medium">Default Workflow</span>
                <select
                  value={draft.defaultWorkflowId ?? ""}
                  onChange={(e) => setDraft({ ...draft, defaultWorkflowId: e.target.value || null })}
                  className="h-9 w-full rounded-lg border bg-bg px-3 text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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

          {/* ── Section 3: QR Flow ── */}
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-caption font-medium text-muted uppercase tracking-wider">
              <QrCode className="size-3" />
              QR Flow
            </p>
            <div className="rounded-lg border bg-surface-sunken/10 p-4">
              <label className="block text-body">
                <span className="mb-1 block font-medium">QR mode</span>
                <select
                  value={draft.qrMode}
                  onChange={(e) => setDraft({ ...draft, qrMode: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-bg px-3 text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  {QR_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {QR_MODE_LABELS[mode] ?? mode}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-caption text-muted">
                {QR_MODE_DESCRIPTIONS[draft.qrMode] ?? ""}
              </p>
            </div>
          </div>

          {/* ── Section 4: Dynamic Form Builder ── */}
          <div>
            <p className="mb-3 text-caption font-medium text-muted uppercase tracking-wider">
              Form Builder
            </p>
            <div className="rounded-lg border bg-surface-sunken/10 p-4">
              <DynamicFormBuilder
                schema={draft.formSchema as { fields: Array<{ key: string; label: string; type: string; required?: boolean; placeholder?: string; options?: string[]; minLength?: number; maxLength?: number }> }}
                onChange={(schema) => setDraft({ ...draft, formSchema: schema as { fields: Array<FormField> } })}
              />
            </div>
          </div>

          {/* ── Section 5: Required Documents ── */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-micro font-medium uppercase tracking-wider text-muted">
                  Required Documents
                </p>
                <p className="mt-1 text-caption text-muted">
                  Ask students to upload supporting documents for this leave type.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft({
                    ...draft,
                    requiredDocuments: [
                      ...draft.requiredDocuments,
                      { code: "", label: "", required: true, acceptedTypes: [] },
                    ],
                  })
                }
              >
                <Plus className="size-4" />
                Add document
              </Button>
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-surface-sunken p-4">
              {draft.requiredDocuments.length === 0 ? (
                <p className="text-caption text-muted">
                  No supporting documents required for this leave type.
                </p>
              ) : (
                draft.requiredDocuments.map((document, index) => (
                  <div key={`${document.code}-${index}`} className="rounded-lg border bg-bg p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-body">
                        <span className="mb-1 block font-medium">Document code</span>
                        <input
                          value={document.code}
                          onChange={(event) => {
                            const requiredDocuments = [...draft.requiredDocuments];
                            requiredDocuments[index] = {
                              ...document,
                              code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
                            };
                            setDraft({ ...draft, requiredDocuments });
                          }}
                          placeholder="MEDICAL_CERTIFICATE"
                          className="h-9 w-full rounded-lg border bg-bg px-3 font-mono text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        />
                      </label>
                      <label className="block text-body">
                        <span className="mb-1 block font-medium">Display label</span>
                        <input
                          value={document.label}
                          onChange={(event) => {
                            const requiredDocuments = [...draft.requiredDocuments];
                            requiredDocuments[index] = { ...document, label: event.target.value };
                            setDraft({ ...draft, requiredDocuments });
                          }}
                          placeholder="Medical certificate"
                          className="h-9 w-full rounded-lg border bg-bg px-3 text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <label className="block min-w-56 flex-1 text-body">
                        <span className="mb-1 block font-medium">Accepted file types</span>
                        <input
                          value={document.acceptedTypes?.join(", ") ?? ""}
                          onChange={(event) => {
                            const acceptedTypes = event.target.value
                              .split(",")
                              .map((type) => type.trim().toUpperCase())
                              .filter(Boolean);
                            const requiredDocuments = [...draft.requiredDocuments];
                            requiredDocuments[index] = { ...document, acceptedTypes };
                            setDraft({ ...draft, requiredDocuments });
                          }}
                          placeholder="PDF, JPG, PNG"
                          className="h-9 w-full rounded-lg border bg-bg px-3 text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        />
                      </label>
                      <label className="flex h-9 items-center gap-2 text-body">
                        <input
                          type="checkbox"
                          checked={document.required}
                          onChange={(event) => {
                            const requiredDocuments = [...draft.requiredDocuments];
                            requiredDocuments[index] = { ...document, required: event.target.checked };
                            setDraft({ ...draft, requiredDocuments });
                          }}
                          className="rounded"
                        />
                        Required
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${document.label || "document"}`}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            requiredDocuments: draft.requiredDocuments.filter((_, itemIndex) => itemIndex !== index),
                          })
                        }
                      >
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Section 6: Preview ── */}
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-caption font-medium text-muted uppercase tracking-wider">
              <Eye className="size-3" />
              Student Preview
            </p>
            <div className="rounded-lg border bg-bg p-4">
              {draft.formSchema.fields.length === 0 ? (
                <p className="text-caption text-muted">No form fields configured.</p>
              ) : (
                <div className="space-y-3">
                  {draft.formSchema.fields.map((field) => (
                    <div key={field.key}>
                      <label className="mb-1 block text-caption font-medium text-ink">
                        {field.label}
                        {field.required && <span className="ml-0.5 text-danger">*</span>}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          readOnly
                          placeholder={field.placeholder ?? `Enter ${(field.label ?? '').toLowerCase()}...`}
                          className="w-full rounded-md border bg-surface-sunken/30 px-3 py-2 text-caption text-muted outline-none"
                          rows={3}
                        />
                      ) : field.type === "select" ? (
                        <select
                          disabled
                          className="h-8 w-full rounded-md border bg-surface-sunken/30 px-3 text-caption text-muted outline-none"
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
                          className="h-8 w-full rounded-md border bg-surface-sunken/30 px-3 text-caption text-muted outline-none"
                        />
                      )}
                      {field.minLength != null && field.maxLength != null && (
                        <p className="mt-0.5 text-micro text-muted">
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
              className={`text-body ${
                message === "Leave type saved." ? "text-success" : "text-muted"
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
