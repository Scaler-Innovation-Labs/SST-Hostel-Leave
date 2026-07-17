"use client";

import { Building2, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { deleteHostel, saveHostel } from "@/lib/api/hostel-api";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => r.data ?? r);

type HostelItem = {
  id: string;
  name: string;
  code: string;
  capacity: number | null;
  curfewStartTime: string | null;
  curfewEndTime: string | null;
  isActive: boolean;
};

type Draft = {
  id?: string;
  name: string;
  code: string;
  capacity: string;
  curfewStartTime: string;
  curfewEndTime: string;
  isActive: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  code: "",
  capacity: "",
  curfewStartTime: "",
  curfewEndTime: "",
  isActive: true,
};

export default function HostelsPage() {
  const { data: hostels, isLoading, error, mutate } = useSWR<HostelItem[]>("/api/v1/hostels", fetcher);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const typedHostels = useMemo(() => hostels ?? [], [hostels]);

  const edit = (hostel: HostelItem) => {
    setDraft({
      id: hostel.id,
      name: hostel.name,
      code: hostel.code,
      capacity: hostel.capacity != null ? String(hostel.capacity) : "",
      curfewStartTime: hostel.curfewStartTime ?? "",
      curfewEndTime: hostel.curfewEndTime ?? "",
      isActive: hostel.isActive,
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
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name: draft.name,
        code: draft.code,
        capacity: draft.capacity ? Number(draft.capacity) : null,
        curfewStartTime: draft.curfewStartTime || null,
        curfewEndTime: draft.curfewEndTime || null,
        isActive: draft.isActive,
      };
      await saveHostel(payload, draft.id);
      await mutate();
      setDraft(EMPTY_DRAFT);
      setMessage("Hostel saved.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Failed to save hostel");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete hostel "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setMessage(null);
    try {
      await deleteHostel(id);
      await mutate();
      setDraft(EMPTY_DRAFT);
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : "Failed to delete hostel");
    } finally {
      setDeletingId(null);
    }
  };

  if (error) return <ErrorState message={error?.message ?? "Failed to load hostels"} onRetry={() => mutate()} />;

  const isEditing = !!draft.id;

  return (
    <div className="space-y-6">
      <PageHeader title="Hostels" description="Manage hostel buildings and their configuration." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Hostels</h2>
            <Button variant="outline" onClick={startNew}><Plus className="size-4" /> New</Button>
          </div>
          {isLoading ? <LoadingState count={5} /> : typedHostels.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <p className="text-sm text-muted-foreground">No hostels yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {typedHostels.map((hostel) => (
                <div key={hostel.id} className="group flex rounded-xl border bg-card hover:border-primary">
                  <button onClick={() => edit(hostel)} className="flex-1 p-4 text-left">
                    <div className="flex items-center gap-3">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{hostel.name}</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {hostel.code} · {hostel.capacity ?? "?"} capacity
                    </p>
                  </button>
                  <Button
                    variant="ghost" size="icon"
                    className="m-2 size-8 shrink-0 opacity-0 group-hover:opacity-100"
                    disabled={deletingId === hostel.id}
                    onClick={() => handleDelete(hostel.id, hostel.name)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">{isEditing ? "Edit Hostel" : "New Hostel"}</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
            <Field label="Code" value={draft.code} onChange={(code) => setDraft({ ...draft, code: code.toUpperCase().replace(/\s+/g, "_") })} mono />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Capacity" value={draft.capacity} onChange={(capacity) => setDraft({ ...draft, capacity })} type="number" />
            <Field label="Curfew Start" value={draft.curfewStartTime} onChange={(curfewStartTime) => setDraft({ ...draft, curfewStartTime })} type="time" />
            <Field label="Curfew End" value={draft.curfewEndTime} onChange={(curfewEndTime) => setDraft({ ...draft, curfewEndTime })} type="time" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
            Active
          </label>

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

function Field({ label, value, onChange, mono = false, type = "text" }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean; type?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className={`h-9 w-full rounded-lg border bg-background px-3 outline-none focus:border-ring focus:ring-1 focus:ring-ring ${mono ? "font-mono" : ""}`} />
    </label>
  );
}
