"use client";

import { Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import useSWR from "swr";
import * as XLSX from "xlsx";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ParentItem = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  relationship: string;
  isPrimary: boolean;
  studentId: string;
  studentName: string | null;
  studentRollNumber: string | null;
};

type ParentListResponse = {
  items: ParentItem[];
  total: number;
  page: number;
  totalPages: number;
};

type StudentItem = {
  id: string;
  rollNumber: string;
  fullName: string;
};

type DraftParent = {
  id?: string;
  studentId: string;
  name: string;
  phone: string;
  email: string;
  relationship: string;
  isPrimary: boolean;
};

const EMPTY_DRAFT: DraftParent = {
  studentId: "",
  name: "",
  phone: "",
  email: "",
  relationship: "",
  isPrimary: false,
};

type BulkResult = {
  row: number;
  success: boolean;
  error?: string;
};

export default function SuperAdminParentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [draft, setDraft] = useState<DraftParent>(EMPTY_DRAFT);
  const [saving, setSaving] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkJson, setBulkJson] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error, mutate } = useSWR<{ success: boolean; data: ParentListResponse }>(
    `/api/v1/parents?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    fetcher,
  );

  const { data: studentsData } = useSWR<{ success: boolean; data: { items: StudentItem[] } }>(
    studentSearch ? `/api/v1/students?search=${encodeURIComponent(studentSearch)}&limit=10` : null,
    fetcher,
  );

  const parents = data?.data;
  const students = studentsData?.data?.items ?? [];

  const startNew = () => {
    setDraft(EMPTY_DRAFT);
    setStudentSearch("");
    setShowBulk(false);
  };

  const editParent = (parent: ParentItem) => {
    setDraft({
      id: parent.id,
      studentId: parent.studentId,
      name: parent.name,
      phone: parent.phone,
      email: parent.email ?? "",
      relationship: parent.relationship,
      isPrimary: parent.isPrimary,
    });
    setStudentSearch("");
  };

  const handleSave = async () => {
    if (!draft.name || !draft.phone || !draft.relationship) return;
    if (!draft.id && !draft.studentId) return;
    setSaving(draft.id ?? "new");
    try {
      if (draft.id) {
        const res = await fetch(`/api/v1/parents/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            phone: draft.phone,
            email: draft.email || "",
            relationship: draft.relationship,
            isPrimary: draft.isPrimary,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message);
        await mutate();
      } else {
        const res = await fetch("/api/v1/parents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: draft.studentId,
            name: draft.name,
            phone: draft.phone,
            email: draft.email || "",
            relationship: draft.relationship,
            isPrimary: draft.isPrimary,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message);
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
    if (!window.confirm("Delete this parent record?")) return;
    try {
      const res = await fetch(`/api/v1/parents/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      if (draft.id === id) setDraft(EMPTY_DRAFT);
      await mutate();
    } catch {
      /* ignore */
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkJson.trim()) return;
    setBulkLoading(true);
    setBulkResults(null);
    try {
      const rows = JSON.parse(bulkJson);
      const res = await fetch("/api/v1/parents/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const json = await res.json();
      if (json.success) {
        setBulkResults(json.data.results);
        await mutate();
      } else {
        setBulkResults([{ row: 0, success: false, error: json.error?.message ?? "Upload failed" }]);
      }
    } catch (err) {
      setBulkResults([{ row: 0, success: false, error: err instanceof Error ? err.message : "Invalid JSON" }]);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkLoading(true);
    setBulkResults(null);
    try {
      let rows: Record<string, unknown>[];

      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error("Excel file has no sheets");
        const ws = wb.Sheets[sheetName]!;
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      } else {
        const text = await file.text();
        const res = await fetch("/api/v1/parents/bulk", {
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: text,
        });
        const json = await res.json();
        if (json.success) {
          setBulkResults(json.data.results);
          await mutate();
        } else {
          setBulkResults([{ row: 0, success: false, error: json.error?.message ?? "Upload failed" }]);
        }
        return;
      }

      const res = await fetch("/api/v1/parents/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const json = await res.json();
      if (json.success) {
        setBulkResults(json.data.results);
        await mutate();
      } else {
        setBulkResults([{ row: 0, success: false, error: json.error?.message ?? "Upload failed" }]);
      }
    } catch (err) {
      setBulkResults([{ row: 0, success: false, error: err instanceof Error ? err.message : "File read failed" }]);
    } finally {
      setBulkLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [mutate]);

  const startBulk = () => {
    setShowBulk(!showBulk);
    setDraft(EMPTY_DRAFT);
    setStudentSearch("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent Management"
        description="View and manage parent records linked to students."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search parents..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>
            <Button variant="outline" onClick={startNew}>
              <Plus className="size-4" /> Add Parent
            </Button>
            <Button variant="outline" onClick={startBulk}>
              <Upload className="size-4" /> {showBulk ? "Cancel Bulk" : "Bulk Upload"}
            </Button>
          </div>

          {showBulk && (
            <div className="space-y-4 rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Bulk Import Parents</h3>
                <a
                  href="/api/v1/parents/template?format=csv"
                  download
                  className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Download CSV Template
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a CSV (.csv) or Excel (.xlsx/.xls) file. Required fields:{" "}
                <code>studentEmail</code>, <code>name</code>, <code>phone</code>, <code>relationship</code>.
              </p>
              <div className="flex gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="text-sm"
                />
                <span className="text-xs text-muted-foreground">or</span>
              </div>
              <textarea
                value={bulkJson}
                onChange={(e) => setBulkJson(e.target.value)}
                className="min-h-[100px] w-full rounded-lg border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring"
                placeholder='[{ "studentEmail": "student@example.com", "name": "John Doe Sr.", "phone": "9876543210", "relationship": "father" }]'
                rows={4}
              />
              <div className="flex gap-2">
                <Button onClick={handleBulkUpload} disabled={!bulkJson.trim() || bulkLoading}>
                  {bulkLoading ? "Uploading..." : "Import"}
                </Button>
              </div>
              {bulkResults && (
                <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-lg border bg-background p-3 text-xs">
                  <p className="font-medium">
                    {bulkResults.filter((r) => r.success).length} succeeded, {bulkResults.filter((r) => !r.success).length} failed
                  </p>
                  {bulkResults.filter((r) => !r.success).map((r, i) => (
                    <p key={i} className="text-red-600">
                      Row {r.row}: {r.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card p-12">
              <p className="text-sm text-muted-foreground">Failed to load parents.</p>
              <Button variant="outline" onClick={() => mutate()}>Retry</Button>
            </div>
          ) : !parents || parents.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No parents found.</p>
          ) : (
            <div className="space-y-2">
              {parents.items.map((parent) => (
                <button
                  key={parent.id}
                  onClick={() => editParent(parent)}
                  className={`w-full rounded-xl border bg-card p-4 text-left hover:border-primary ${
                    draft.id === parent.id ? "border-primary" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{parent.name}</span>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {parent.relationship}
                        {parent.studentName && (
                          <> &middot; {parent.studentName} ({parent.studentRollNumber ?? "—"})</>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {parent.phone}
                        {parent.email && <> &middot; {parent.email}</>}
                      </div>
                    </div>
                    {parent.isPrimary && (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                        Primary
                      </span>
                    )}
                  </div>
                </button>
              ))}

              {parents.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {parents.page} / {parents.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(parents.totalPages, p + 1))}
                    disabled={page >= parents.totalPages}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">
            {draft.id ? "Edit Parent" : "New Parent"}
          </h2>

          <div className="space-y-4">
            {!draft.id && (
              <div className="space-y-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Student</span>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-xs outline-none focus:border-ring"
                    />
                  </div>
                </label>
                {students.length > 0 && (
                  <div className="max-h-[120px] space-y-1 overflow-y-auto rounded-lg border bg-background p-1">
                    {students.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setDraft({ ...draft, studentId: s.id });
                          setStudentSearch(s.fullName);
                        }}
                        className={`w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted ${
                          draft.studentId === s.id ? "bg-primary/10" : ""
                        }`}
                      >
                        {s.fullName} ({s.rollNumber})
                      </button>
                    ))}
                  </div>
                )}
                {draft.studentId && (
                  <div className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                    Student selected
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({ ...draft, studentId: "" });
                        setStudentSearch("");
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {draft.id && (
              <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Student ID: {draft.studentId}
              </div>
            )}

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                placeholder="Parent name"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Phone</span>
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                  placeholder="Phone number"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Email</span>
                <input
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                  placeholder="email@example.com"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Relationship</span>
              <input
                value={draft.relationship}
                onChange={(e) => setDraft({ ...draft, relationship: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                placeholder="e.g. father, mother, guardian"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isPrimary}
                onChange={(e) => setDraft({ ...draft, isPrimary: e.target.checked })}
              />
              Primary contact
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={
                !draft.name || !draft.phone || !draft.relationship || (!draft.id && !draft.studentId) || saving !== null
              }
            >
              <Save className="size-4" />
              {saving === (draft.id ?? "new") ? "Saving..." : "Save Parent"}
            </Button>
            {draft.id && (
              <Button variant="destructive" onClick={() => handleDelete(draft.id!)}>
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
