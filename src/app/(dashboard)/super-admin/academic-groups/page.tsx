"use client";

import { GraduationCap, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { deleteAcademicGroup, saveAcademicGroup } from "@/lib/api/academic-group-api";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => r.data ?? r);

type DepartmentItem = { id: string; code: string; name: string };
type AcademicGroupItem = {
  id: string;
  departmentId: string;
  batchYear: number;
  name: string;
  groupCode: string | null;
  isActive: boolean;
};

type Draft = {
  id?: string;
  departmentId: string;
  batchYear: string;
  name: string;
  groupCode: string;
  isActive: boolean;
};

const CURRENT_YEAR = new Date().getFullYear();

const EMPTY_DRAFT: Draft = {
  departmentId: "",
  batchYear: String(CURRENT_YEAR),
  name: "",
  groupCode: "",
  isActive: true,
};

export default function AcademicGroupsPage() {
  const { data: groupsData, isLoading, error, mutate } = useSWR<AcademicGroupItem[]>("/api/v1/academic-groups", fetcher);
  const { data: departments } = useSWR<DepartmentItem[]>("/api/v1/departments", fetcher);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const typedGroups = useMemo(() => groupsData ?? [], [groupsData]);
  const typedDepartments = useMemo(() => departments ?? [], [departments]);

  const deptNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of typedDepartments) map[d.id] = d.name;
    return map;
  }, [typedDepartments]);

  const edit = (group: AcademicGroupItem) => {
    setDraft({
      id: group.id,
      departmentId: group.departmentId,
      batchYear: String(group.batchYear),
      name: group.name,
      groupCode: group.groupCode ?? "",
      isActive: group.isActive,
    });
    setMessage(null);
  };

  const startNew = () => {
    setDraft(EMPTY_DRAFT);
    setMessage(null);
  };

  const submit = async () => {
    if (!draft.name.trim() || !draft.departmentId || !draft.batchYear) {
      setMessage("Name, department, and batch year are required.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name: draft.name,
        departmentId: draft.departmentId,
        batchYear: Number(draft.batchYear),
        groupCode: draft.groupCode || null,
        isActive: draft.isActive,
      };
      await saveAcademicGroup(payload, draft.id);
      await mutate();
      setDraft(EMPTY_DRAFT);
      setMessage("Academic group saved.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Failed to save academic group");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete academic group "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setMessage(null);
    try {
      await deleteAcademicGroup(id);
      await mutate();
      setDraft(EMPTY_DRAFT);
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : "Failed to delete academic group");
    } finally {
      setDeletingId(null);
    }
  };

  if (error) return <ErrorState message={error?.message ?? "Failed to load academic groups"} onRetry={() => mutate()} />;

  const isEditing = !!draft.id;

  return (
    <div className="space-y-6">
      <PageHeader title="Academic Groups" description="Manage batches, sections, and academic cohorts." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Groups</h2>
            <Button variant="outline" onClick={startNew}><Plus className="size-4" /> New</Button>
          </div>
          {isLoading ? <LoadingState count={5} /> : typedGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <p className="text-sm text-muted-foreground">No academic groups yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {typedGroups.map((group) => (
                <div key={group.id} className="group flex rounded-xl border bg-card hover:border-primary">
                  <button onClick={() => edit(group)} className="flex-1 p-4 text-left">
                    <div className="flex items-center gap-3">
                      <GraduationCap className="size-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{group.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Batch {group.batchYear} · {deptNameById[group.departmentId] ?? "Unknown dept"}
                      {group.groupCode ? ` · ${group.groupCode}` : ""}
                      <span className={`ml-2 ${group.isActive ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {group.isActive ? "Active" : "Inactive"}
                      </span>
                    </p>
                  </button>
                  <Button
                    variant="ghost" size="icon"
                    className="m-2 size-8 shrink-0 opacity-0 group-hover:opacity-100"
                    disabled={deletingId === group.id}
                    onClick={() => handleDelete(group.id, group.name)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">{isEditing ? "Edit Academic Group" : "New Academic Group"}</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Name</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. CSE Batch 2028"
                className="h-9 w-full rounded-lg border bg-background px-3 outline-none focus:border-ring focus:ring-1 focus:ring-ring" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Group Code</span>
              <input value={draft.groupCode} onChange={(e) => setDraft({ ...draft, groupCode: e.target.value })}
                placeholder="e.g. A1"
                className="h-9 w-full rounded-lg border bg-background px-3 font-mono outline-none focus:border-ring focus:ring-1 focus:ring-ring" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Department</span>
              <select value={draft.departmentId} onChange={(e) => setDraft({ ...draft, departmentId: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 outline-none focus:border-ring focus:ring-1 focus:ring-ring">
                <option value="">Select department</option>
                {typedDepartments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Batch Year</span>
              <input type="number" min={1900} max={2100} value={draft.batchYear}
                onChange={(e) => setDraft({ ...draft, batchYear: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 outline-none focus:border-ring focus:ring-1 focus:ring-ring" />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
            Active
          </label>

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={submit} disabled={saving || !draft.name.trim() || !draft.departmentId}>
              <Save className="size-4" /> {saving ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
