"use client";

import { Building2, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { deleteDepartment, saveDepartment } from "@/lib/api/department-api";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => r.data ?? r);

type DepartmentItem = {
  id: string;
  code: string;
  name: string;
};

type Draft = {
  id?: string;
  code: string;
  name: string;
};

const EMPTY_DRAFT: Draft = { code: "", name: "" };

export default function DepartmentsPage() {
  const { data: departments, isLoading, error, mutate } = useSWR<DepartmentItem[]>("/api/v1/departments", fetcher);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const typedDepartments = useMemo(() => departments ?? [], [departments]);

  const edit = (dept: DepartmentItem) => {
    setDraft({ id: dept.id, code: dept.code, name: dept.name });
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
    setSaving(true);
    setMessage(null);
    try {
      await saveDepartment({ name: draft.name, code: draft.code }, draft.id);
      await mutate();
      setDraft(EMPTY_DRAFT);
      setMessage("Department saved.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Failed to save department");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete department "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setMessage(null);
    try {
      await deleteDepartment(id);
      await mutate();
      setDraft(EMPTY_DRAFT);
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : "Failed to delete department");
    } finally {
      setDeletingId(null);
    }
  };

  if (error) return <ErrorState message={error?.message ?? "Failed to load departments"} onRetry={() => mutate()} />;

  const isEditing = !!draft.id;

  return (
    <div className="space-y-6">
      <PageHeader title="Departments" description="Manage academic departments." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Departments</h2>
            <Button variant="outline" onClick={startNew}><Plus className="size-4" /> New</Button>
          </div>
          {isLoading ? <LoadingState count={5} /> : typedDepartments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <p className="text-sm text-muted-foreground">No departments yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {typedDepartments.map((dept) => (
                <div key={dept.id} className="group flex rounded-xl border bg-card hover:border-primary">
                  <button onClick={() => edit(dept)} className="flex-1 p-4 text-left">
                    <div className="flex items-center gap-3">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{dept.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">({dept.code})</span>
                    </div>
                  </button>
                  <Button
                    variant="ghost" size="icon"
                    className="m-2 size-8 shrink-0 opacity-0 group-hover:opacity-100"
                    disabled={deletingId === dept.id}
                    onClick={() => handleDelete(dept.id, dept.name)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">{isEditing ? "Edit Department" : "New Department"}</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Name</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 outline-none focus:border-ring focus:ring-1 focus:ring-ring" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Code</span>
              <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                className="h-9 w-full rounded-lg border bg-background px-3 font-mono outline-none focus:border-ring focus:ring-1 focus:ring-ring" />
            </label>
          </div>

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={submit} disabled={saving || !draft.name.trim() || !draft.code.trim()}>
              <Save className="size-4" /> {saving ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
