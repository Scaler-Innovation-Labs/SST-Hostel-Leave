"use client";

import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useWorkflows } from "@/features/workflows/hooks/use-workflows";
import { deleteWorkflow, saveWorkflow } from "@/lib/api/workflow-api";

type StepDraft = {
  stepKey: string;
  approverRoleCode: string | null;
  isParentApproval: boolean;
  approvalMethod: "SMS_REPLY" | "SMS_AND_LINK" | "SMS_LINK" | "PORTAL" | "AUTO" | null;
  isRequired: boolean;
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
  steps: [{ stepKey: "POC_APPROVAL", approverRoleCode: "POC", isParentApproval: false, approvalMethod: "PORTAL", isRequired: true }],
};

export default function SuperAdminWorkflowsPage() {
  const { data, isLoading, isError, error, mutate } = useWorkflows({ page: 1, limit: 100 });
  const [draft, setDraft] = useState<WorkflowDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const edit = (workflow: NonNullable<typeof data>["items"][number]) => setDraft({
    id: workflow.id,
    code: workflow.code,
    name: workflow.name,
    description: workflow.description ?? "",
    isActive: workflow.isActive,
    steps: workflow.steps.map((step) => ({
      stepKey: step.stepKey,
      approverRoleCode: step.approverRoleCode,
      isParentApproval: step.isParentApproval,
      approvalMethod: step.approvalMethod as StepDraft["approvalMethod"],
      isRequired: step.isRequired,
    })),
  });

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

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveWorkflow(draft, draft.id);
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

  if (isError) return <ErrorState message={error?.message ?? "Failed to load workflows"} onRetry={() => mutate()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Workflow Studio" description="Build and version ordered approval workflows." />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Definitions</h2>
            <Button variant="outline" onClick={() => setDraft(EMPTY_DRAFT)}><Plus className="size-4" /> New</Button>
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
        </section>

        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
            <Field label="Code" value={draft.code} onChange={(code) => setDraft({ ...draft, code: code.toUpperCase().replace(/\s+/g, "_") })} mono />
          </div>
          <Field label="Description" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Active</label>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Approval steps</h3>
              <Button variant="outline" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { stepKey: "ADMIN_APPROVAL", approverRoleCode: "ADMIN", isParentApproval: false, approvalMethod: "PORTAL", isRequired: true }] })}><Plus className="size-4" /> Add step</Button>
            </div>
            {draft.steps.map((step, index) => (
              <div key={`${step.stepKey}-${index}`} className="space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Step {index + 1}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" onClick={() => moveStep(index, -1)}><ArrowUp className="size-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => moveStep(index, 1)}><ArrowDown className="size-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, stepIndex) => stepIndex !== index) })}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Step key" value={step.stepKey} onChange={(stepKey) => updateStep(index, { stepKey: stepKey.toUpperCase().replace(/\s+/g, "_") })} mono />
                  <SelectField label="Approver" value={step.isParentApproval ? "PARENT" : step.approverRoleCode ?? ""} options={["POC", "ADMIN", "SUPER_ADMIN", "PARENT"]} onChange={(value) => updateStep(index, { isParentApproval: value === "PARENT", approverRoleCode: value === "PARENT" ? null : value })} />
                  <SelectField label="Method" value={step.approvalMethod ?? "PORTAL"} options={["PORTAL", "SMS_REPLY", "SMS_LINK", "SMS_AND_LINK", "AUTO"]} onChange={(value) => updateStep(index, { approvalMethod: value as StepDraft["approvalMethod"] })} />
                </div>
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

function Field({ label, value, onChange, mono = false }: { label: string; value: string; onChange: (value: string) => void; mono?: boolean }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className={`h-9 w-full rounded-lg border bg-background px-3 ${mono ? "font-mono" : ""}`} /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border bg-background px-3">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
