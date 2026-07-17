"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, GripVertical, Plus, Save, Search, Timer, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import { useWorkflows } from "@/features/workflows/hooks/use-workflows";
import { deleteWorkflow, saveWorkflow } from "@/lib/api/workflow-api";
import { ROLES } from "@/lib/auth/roles";

type StepDraft = {
  stepKey: string;
  approverRoleCode: string | null;
  isParentApproval: boolean;
  approvalMethod: "SMS_REPLY" | "SMS_AND_LINK" | "SMS_LINK" | "PORTAL" | "AUTO" | null;
  isRequired: boolean;
  condition: string;
  timeoutHours: string;
  escalateToStepKey: string;
  notes: string;
};

type WorkflowDraft = {
  id?: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  steps: StepDraft[];
};

const EMPTY_DRAFT: WorkflowDraft = {
  code: "",
  name: "",
  description: "",
  isActive: true,
  steps: [{ stepKey: WORKFLOW_STEP_KEY.POC_APPROVAL, approverRoleCode: ROLES.POC, isParentApproval: false, approvalMethod: "PORTAL", isRequired: true, condition: "", timeoutHours: "", escalateToStepKey: "", notes: "" }],
};

const ROLE_OPTIONS = [ROLES.POC, ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.GUARD];
const METHOD_OPTIONS = ["PORTAL", "SMS_REPLY", "SMS_LINK", "SMS_AND_LINK", "AUTO"];

export default function SuperAdminWorkflowsPage() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterActive, setFilterActive] = useState<string>("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, mutate } = useWorkflows({
    search: search || undefined,
    isActive: filterActive || undefined,
    page,
    limit: 10,
  });
  const [draft, setDraft] = useState<WorkflowDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }, []);

  const edit = (workflow: NonNullable<typeof data>["items"][number]) => {
    setDraft({
      id: workflow.id,
      code: workflow.code,
      name: workflow.name,
      description: workflow.description ?? "",
      isActive: workflow.isActive,
      steps: workflow.steps.map((step) => {
        const m = step.metadata ?? {};
        return {
          stepKey: step.stepKey,
          approverRoleCode: step.approverRoleCode,
          isParentApproval: step.isParentApproval,
          approvalMethod: step.approvalMethod as StepDraft["approvalMethod"],
          isRequired: step.isRequired,
          condition: (m.condition as string) ?? "",
          timeoutHours: (m.timeoutHours != null ? String(m.timeoutHours) : "") as string,
          escalateToStepKey: (m.escalateToStepKey as string) ?? "",
          notes: (m.notes as string) ?? "",
        };
      }),
    });
  };

  const updateStep = (index: number, patch: Partial<StepDraft>) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step),
    }));
  };

  const moveStep = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[index], steps[target]] = [steps[target]!, steps[index]!];
    setDraft({ ...draft, steps });
  };

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const steps = [...draft.steps];
    const [removed] = steps.splice(dragIndex, 1);
    steps.splice(index, 0, removed!);
    setDragIndex(index);
    setDraft({ ...draft, steps });
  };

  const handleDragEnd = () => setDragIndex(null);

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...draft,
        steps: draft.steps.map((step) => ({
          stepKey: step.stepKey,
          approverRoleCode: step.approverRoleCode,
          isParentApproval: step.isParentApproval,
          approvalMethod: step.approvalMethod,
          isRequired: step.isRequired,
          condition: step.condition || null,
          timeoutHours: step.timeoutHours ? Number(step.timeoutHours) : null,
          escalateToStepKey: step.escalateToStepKey || null,
          notes: step.notes || null,
        })),
      };
      await saveWorkflow(payload, draft.id);
      await mutate();
      setDraft(EMPTY_DRAFT);
      setMessage("Workflow saved.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete workflow "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setMessage(null);
    try {
      await deleteWorkflow(id);
      await mutate();
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : "Failed to delete workflow");
    } finally {
      setDeletingId(null);
    }
  };

  const addStep = () => {
    const stepNum = draft.steps.length + 1;
    setDraft({
      ...draft,
      steps: [...draft.steps, { stepKey: `STEP_${stepNum}`, approverRoleCode: ROLES.ADMIN, isParentApproval: false, approvalMethod: "PORTAL", isRequired: true, condition: "", timeoutHours: "", escalateToStepKey: "", notes: "" }],
    });
  };

  if (isError) return <ErrorState message={error?.message ?? "Failed to load workflows"} onRetry={() => mutate()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Workflow Studio" description="Build and version ordered approval workflows." />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        {/* Definition list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Definitions</h2>
            <Button variant="outline" onClick={() => { setDraft(EMPTY_DRAFT); clearSearch(); }}><Plus className="size-4" /> New</Button>
          </div>

          {/* Search & filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="h-9 w-full rounded-lg border bg-background pl-9 pr-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              {searchInput && (
                <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <select
              value={filterActive}
              onChange={(e) => { setFilterActive(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            >
              <option value="">All status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <Button variant="secondary" size="sm" onClick={handleSearch} className="h-9">Search</Button>
          </div>

          {isLoading ? <LoadingState count={4} /> : data?.items.map((workflow) => (
            <div key={workflow.id} className="group flex rounded-xl border bg-card hover:border-primary">
              <button onClick={() => edit(workflow)} className="flex-1 p-4 text-left">
                <div className="flex justify-between gap-3"><span className="font-medium">{workflow.name}</span><span className="text-xs text-muted-foreground">v{workflow.version}</span></div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{workflow.code} · {workflow.steps.length} steps · {workflow.isActive ? "Active" : "Inactive"}</div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="m-2 size-8 shrink-0 opacity-0 group-hover:opacity-100"
                disabled={deletingId === workflow.id}
                onClick={() => handleDelete(workflow.id, workflow.name)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
              <span>{data.total} workflow{data.total !== 1 ? "s" : ""}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-[5rem] text-center">
                  Page {data.page} of {data.totalPages}
                </span>
                <Button variant="outline" size="icon" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Editor */}
        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
            <Field label="Code" value={draft.code} onChange={(code) => setDraft({ ...draft, code: code.toUpperCase().replace(/\s+/g, "_") })} mono />
          </div>
          <Field label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Active</label>

          {/* Pipeline preview */}
          {draft.steps.length > 0 && (
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline Preview</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">Start</span>
                <span className="text-muted-foreground">→</span>
                {draft.steps.map((step, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className={`rounded-lg px-3 py-1.5 text-xs font-medium ${step.isParentApproval ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                      {step.isParentApproval ? "Parent" : step.approverRoleCode ?? "?"}{step.isRequired ? "" : " (opt)"}
                      {step.condition ? "*" : ""}
                      {step.timeoutHours ? <Timer className="ml-1 inline size-3" /> : null}
                    </span>
                    {i < draft.steps.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                ))}
                <span className="text-muted-foreground">→</span>
                <span className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Done</span>
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Approval steps</h3>
              <Button variant="outline" onClick={addStep}><Plus className="size-4" /> Add step</Button>
            </div>
            {draft.steps.map((step, index) => (
              <div
                key={`${step.stepKey}-${index}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`space-y-3 rounded-xl border p-4 transition-all ${dragIndex === index ? "opacity-50 ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="size-4 cursor-grab text-muted-foreground" />
                    <span className="text-sm font-medium">Step {index + 1}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" onClick={() => moveStep(index, -1)}><ArrowUp className="size-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => moveStep(index, 1)}><ArrowDown className="size-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, stepIndex) => stepIndex !== index) })}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Step key" value={step.stepKey} onChange={(stepKey) => updateStep(index, { stepKey: stepKey.toUpperCase().replace(/\s+/g, "_") })} mono />
                  <SelectField label="Approver" value={step.isParentApproval ? "PARENT" : step.approverRoleCode ?? ""} options={[...ROLE_OPTIONS, "PARENT"]} onChange={(value) => updateStep(index, { isParentApproval: value === "PARENT", approverRoleCode: value === "PARENT" ? null : value })} />
                  <SelectField label="Method" value={step.approvalMethod ?? "PORTAL"} options={METHOD_OPTIONS} onChange={(value) => updateStep(index, { approvalMethod: value as StepDraft["approvalMethod"] })} />
                </div>

                {/* Collapsible advanced fields */}
                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Advanced settings</summary>
                  <div className="mt-3 space-y-3">
                    <Field label="Condition (leave property)" value={step.condition} onChange={(condition) => updateStep(index, { condition })} placeholder="e.g. days > 3" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Timeout (hours)" value={step.timeoutHours} onChange={(timeoutHours) => updateStep(index, { timeoutHours })} type="number" placeholder="e.g. 24" />
                      <SelectField label="Escalate to" value={step.escalateToStepKey} options={["", ...draft.steps.map((s) => s.stepKey)]} onChange={(escalateToStepKey) => updateStep(index, { escalateToStepKey })} />
                    </div>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Notes</span>
                      <textarea value={step.notes} onChange={(e) => updateStep(index, { notes: e.target.value })} rows={2} placeholder="Internal notes about this step"
                        className="w-full rounded-lg border bg-background p-2 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring" />
                    </label>
                  </div>
                </details>

                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={step.isRequired} onChange={(event) => updateStep(index, { isRequired: event.target.checked })} /> Required step</label>
              </div>
            ))}
          </div>

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <div className="flex justify-end"><Button onClick={submit} disabled={saving || draft.steps.length === 0}><Save className="size-4" /> {saving ? "Saving..." : "Save workflow"}</Button></div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, mono = false, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; mono?: boolean; type?: string; placeholder?: string }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`h-9 w-full rounded-lg border bg-background px-3 outline-none focus:border-ring focus:ring-1 focus:ring-ring ${mono ? "font-mono" : ""}`} /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border bg-background px-3 outline-none focus:border-ring focus:ring-1 focus:ring-ring">{options.map((option) => <option key={option} value={option}>{option || "None"}</option>)}</select></label>;
}
