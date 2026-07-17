"use client";

import { Plus, Save, Search, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import useSWR from "swr";
import * as XLSX from "xlsx";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type StudentItem = {
  student: {
    id: string;
    rollNumber: string;
    academicGroupId: string;
    roomNumber: string | null;
    currentLocationState: string;
    userId: string;
    createdAt: string;
  };
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    gender: string | null;
    isActive: boolean;
    hostelId: string | null;
  } | null;
  locationState: { code: string; name: string } | null;
};

type StudentListResponse = {
  items: StudentItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type DraftStudent = {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  rollNumber: string;
  academicGroupId: string;
  roomNumber: string;
  hostelId: string;
  isActive: boolean;
};

const EMPTY_DRAFT: DraftStudent = {
  fullName: "",
  email: "",
  phone: "",
  gender: "",
  rollNumber: "",
  academicGroupId: "",
  roomNumber: "",
  hostelId: "",
  isActive: true,
};

type ParentRecord = {
  id: string;
  studentId: string;
  name: string;
  phone: string;
  email: string | null;
  relationship: string;
  isPrimary: boolean;
};

type BulkResult = {
  rollNumber?: string;
  row?: number;
  success: boolean;
  error?: string;
};

type NewParentForm = {
  name: string;
  phone: string;
  email: string;
  relationship: string;
  isPrimary: boolean;
};

const EMPTY_PARENT_FORM: NewParentForm = {
  name: "",
  phone: "",
  email: "",
  relationship: "",
  isPrimary: false,
};

export default function SuperAdminStudentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<DraftStudent>(EMPTY_DRAFT);
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkSection, setBulkSection] = useState<"students" | "parents" | null>(null);
  const [bulkJson, setBulkJson] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parentFileInputRef = useRef<HTMLInputElement>(null);
  const [parentForm, setParentForm] = useState<NewParentForm>(EMPTY_PARENT_FORM);
  const [savingParent, setSavingParent] = useState(false);

  const { data, isLoading, error, mutate } = useSWR<{ success: boolean; data: StudentListResponse }>(
    `/api/v1/students?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    fetcher,
  );

  const { data: academicGroupsData } = useSWR<{ success: boolean; data: Array<{ id: string; name: string; code: string | null }> }>(
    "/api/v1/academic-groups",
    fetcher,
  );

  const { data: hostelsData } = useSWR<{ success: boolean; data: Array<{ id: string; name: string }> }>(
    "/api/v1/hostels",
    fetcher,
  );

  const { data: parentsData, mutate: mutateParents } = useSWR<{ success: boolean; data: { items: ParentRecord[] } }>(
    draft.id ? `/api/v1/parents?studentId=${draft.id}&limit=50` : null,
    fetcher,
  );

  const students = data?.data;
  const academicGroups = academicGroupsData?.data ?? [];
  const hostels = hostelsData?.data ?? [];
  const parents = parentsData?.data?.items ?? [];

  const startNew = () => {
    setDraft(EMPTY_DRAFT);
    setBulkSection(null);
  };

  const editStudent = (item: StudentItem) => {
    setDraft({
      id: item.student.id,
      fullName: item.user?.fullName ?? "",
      email: item.user?.email ?? "",
      phone: item.user?.phone ?? "",
      gender: item.user?.gender ?? "",
      rollNumber: item.student.rollNumber,
      academicGroupId: item.student.academicGroupId,
      roomNumber: item.student.roomNumber ?? "",
      hostelId: item.user?.hostelId ?? "",
      isActive: item.user?.isActive ?? true,
    });
    setBulkSection(null);
    setParentForm(EMPTY_PARENT_FORM);
  };

  const handleSave = async () => {
    if (!draft.fullName || !draft.rollNumber || !draft.academicGroupId) return;
    setSaving(draft.id ?? "new");
    try {
      if (draft.id) {
        const res = await fetch(`/api/v1/students/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fullName: draft.fullName,
              email: draft.email || "",
              phone: draft.phone || "",
              gender: draft.gender || null,
              rollNumber: draft.rollNumber,
              academicGroupId: draft.academicGroupId,
              roomNumber: draft.roomNumber || null,
              isActive: draft.isActive,
              hostelId: draft.hostelId || null,
            }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message);
        await mutate();
      } else {
        const res = await fetch("/api/v1/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: draft.fullName,
            email: draft.email || "",
            phone: draft.phone || "",
            gender: draft.gender || null,
            rollNumber: draft.rollNumber,
            academicGroupId: draft.academicGroupId,
            roomNumber: draft.roomNumber || null,
            hostelId: draft.hostelId || null,
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
    if (!window.confirm("Delete this student and their user account? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/v1/students/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      if (draft.id === id) setDraft(EMPTY_DRAFT);
      await mutate();
    } catch {
      /* ignore */
    }
  };

  const handleAddParent = async () => {
    if (!draft.id || !parentForm.name || !parentForm.phone || !parentForm.relationship) return;
    setSavingParent(true);
    try {
      const res = await fetch("/api/v1/parents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: draft.id,
          name: parentForm.name,
          phone: parentForm.phone,
          email: parentForm.email || "",
          relationship: parentForm.relationship,
          isPrimary: parentForm.isPrimary,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setParentForm(EMPTY_PARENT_FORM);
      await mutateParents();
    } catch {
      /* ignore */
    } finally {
      setSavingParent(false);
    }
  };

  const handleDeleteParent = async (parentId: string) => {
    if (!window.confirm("Remove this parent?")) return;
    try {
      const res = await fetch(`/api/v1/parents/${parentId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      await mutateParents();
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
      const endpoint = bulkSection === "parents" ? "/api/v1/parents/bulk" : "/api/v1/students/bulk";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const json = await res.json();
      if (json.success) {
        setBulkResults(json.data.results);
        await mutate();
        if (bulkSection === "parents" && draft.id) await mutateParents();
      } else {
        setBulkResults([{ success: false, error: json.error?.message ?? "Upload failed" }]);
      }
    } catch (err) {
      setBulkResults([{ success: false, error: err instanceof Error ? err.message : "Invalid JSON" }]);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bulkSection) return;
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
        const endpoint = bulkSection === "parents" ? "/api/v1/parents/bulk" : "/api/v1/students/bulk";
        const contentType = bulkSection === "parents" ? "application/json" : "text/csv";
        const body = bulkSection === "parents" ? JSON.stringify(parseSimpleCsv(text)) : text;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": contentType },
          body,
        });
        const json = await res.json();
        if (json.success) {
          setBulkResults(json.data.results);
          await mutate();
          if (bulkSection === "parents" && draft.id) await mutateParents();
        } else {
          setBulkResults([{ success: false, error: json.error?.message ?? "Upload failed" }]);
        }
        return;
      }

      const endpoint = bulkSection === "parents" ? "/api/v1/parents/bulk" : "/api/v1/students/bulk";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const json = await res.json();
      if (json.success) {
        setBulkResults(json.data.results);
        await mutate();
        if (bulkSection === "parents" && draft.id) await mutateParents();
      } else {
        setBulkResults([{ success: false, error: json.error?.message ?? "Upload failed" }]);
      }
    } catch (err) {
      setBulkResults([{ success: false, error: err instanceof Error ? err.message : "File read failed" }]);
    } finally {
      setBulkLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [mutate, mutateParents, bulkSection, draft.id]);

  const toggleBulk = (section: "students" | "parents") => {
    if (bulkSection === section) {
      setBulkSection(null);
    } else {
      setBulkSection(section);
      setDraft(EMPTY_DRAFT);
      setBulkResults(null);
      setBulkJson("");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Management"
        description="Manage student records, parents, and bulk imports."
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or roll number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button variant="outline" onClick={() => { startNew(); setBulkSection(null); }}>
          <Plus className="size-4" /> Add Student
        </Button>
        <Button variant="outline" onClick={() => { toggleBulk("students"); }}>
          <Upload className="size-4" /> Bulk Students
        </Button>
        <Button variant="outline" onClick={() => { toggleBulk("parents"); }}>
          <Users className="size-4" /> Bulk Parents
        </Button>
      </div>

      {bulkSection && (
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Bulk Import {bulkSection === "parents" ? "Parents" : "Students"}</h3>
            {bulkSection === "students" && (
              <a
                href="/api/v1/students/template?format=csv"
                download
                className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Download CSV Template
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {bulkSection === "parents"
              ? "Upload a CSV (.csv) or Excel (.xlsx/.xls) file. Required fields: <code>studentId</code>, <code>name</code>, <code>phone</code>, <code>relationship</code>."
              : "Upload a CSV (.csv) or Excel (.xlsx/.xls) file. Required fields: <code>rollNumber</code>, <code>fullName</code>, <code>academicGroupId</code>."}
          </p>
          <div className="flex gap-3">
            <input
              ref={bulkSection === "parents" ? parentFileInputRef : fileInputRef}
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
            placeholder={
              bulkSection === "parents"
                ? '[{ "studentId": "uuid", "name": "Father Name", "phone": "9876543210", "relationship": "Father" }]'
                : '[{ "rollNumber": "S001", "fullName": "John Doe", "academicGroupId": "uuid-here" }]'
            }
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
                  {r.rollNumber ? `${r.rollNumber}: ` : r.row ? `Row ${r.row}: ` : ""}{r.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="space-y-3">
          <h2 className="font-semibold">Students</h2>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card p-12">
              <p className="text-sm text-muted-foreground">Failed to load students.</p>
              <Button variant="outline" onClick={() => mutate()}>Retry</Button>
            </div>
          ) : !students || students.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students found.</p>
          ) : (
            <div className="space-y-2">
              {students.items.map((item) => (
                <button
                  key={item.student.id}
                  onClick={() => editStudent(item)}
                  className={`w-full rounded-xl border bg-card p-4 text-left hover:border-primary ${
                    draft.id === item.student.id ? "border-primary" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{item.user?.fullName ?? "—"}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{item.student.rollNumber}</span>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {item.user?.email ?? "—"}
                        {item.user?.phone && <> &middot; {item.user.phone}</>}
                      </div>
                      {item.student.roomNumber && (
                        <div className="mt-0.5 text-xs text-muted-foreground">Room: {item.student.roomNumber}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.user?.isActive ?? true
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.user?.isActive ?? true ? "Active" : "Inactive"}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {item.locationState?.name ?? item.student.currentLocationState}
                      </span>
                    </div>
                  </div>
                </button>
              ))}

              {students.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {students.page} / {students.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(students.totalPages, p + 1))}
                    disabled={page >= students.totalPages}
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
            {draft.id ? "Edit Student" : "New Student"}
          </h2>

          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Full Name</span>
              <input
                value={draft.fullName}
                onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                placeholder="Student name"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Roll Number</span>
                <input
                  value={draft.rollNumber}
                  onChange={(e) => setDraft({ ...draft, rollNumber: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                  placeholder="e.g. S001"
                  readOnly={!!draft.id}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Room Number</span>
                <input
                  value={draft.roomNumber}
                  onChange={(e) => setDraft({ ...draft, roomNumber: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                  placeholder="e.g. A-101"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Academic Group</span>
              <select
                value={draft.academicGroupId}
                onChange={(e) => setDraft({ ...draft, academicGroupId: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs"
              >
                <option value="">Select academic group...</option>
                {academicGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}{g.code ? ` (${g.code})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Email</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                  placeholder="email@example.com"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Phone</span>
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:border-ring"
                  placeholder="Phone number"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Gender</span>
                <select
                  value={draft.gender}
                  onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-xs"
                >
                  <option value="">Select...</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Hostel</span>
                <select
                  value={draft.hostelId}
                  onChange={(e) => setDraft({ ...draft, hostelId: e.target.value })}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-xs"
                >
                  <option value="">No hostel</option>
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {draft.id && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                />
                Active
              </label>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={!draft.fullName || !draft.rollNumber || !draft.academicGroupId || saving !== null}
            >
              <Save className="size-4" />
              {saving === (draft.id ?? "new") ? "Saving..." : "Save Student"}
            </Button>
            {draft.id && (
              <Button variant="destructive" onClick={() => handleDelete(draft.id!)}>
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
          </div>

          {/* Parents Section — only when editing a student */}
          {draft.id && (
            <div className="border-t border-border pt-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="size-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Parents</h3>
              </div>

              {parents.length === 0 ? (
                <p className="text-xs text-muted-foreground mb-3">No parents linked to this student.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {parents.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                      <div className="min-w-0 text-xs">
                        <span className="font-medium">{p.name}</span>
                        {p.isPrimary && (
                          <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Primary</span>
                        )}
                        <div className="text-muted-foreground">{p.relationship} &middot; {p.phone}</div>
                        {p.email && <div className="text-muted-foreground">{p.email}</div>}
                      </div>
                      <button
                        onClick={() => handleDeleteParent(p.id)}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remove parent"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-dashed p-3 space-y-2">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <UserPlus className="size-3.5" />
                  Add Parent
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={parentForm.name}
                    onChange={(e) => setParentForm({ ...parentForm, name: e.target.value })}
                    placeholder="Parent name"
                    className="h-8 rounded-lg border bg-background px-2.5 text-xs outline-none focus:border-ring"
                  />
                  <input
                    value={parentForm.phone}
                    onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })}
                    placeholder="Phone"
                    className="h-8 rounded-lg border bg-background px-2.5 text-xs outline-none focus:border-ring"
                  />
                  <input
                    value={parentForm.email}
                    onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })}
                    placeholder="Email (optional)"
                    className="h-8 rounded-lg border bg-background px-2.5 text-xs outline-none focus:border-ring"
                  />
                  <input
                    value={parentForm.relationship}
                    onChange={(e) => setParentForm({ ...parentForm, relationship: e.target.value })}
                    placeholder="Relationship (e.g. Father)"
                    className="h-8 rounded-lg border bg-background px-2.5 text-xs outline-none focus:border-ring"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={parentForm.isPrimary}
                    onChange={(e) => setParentForm({ ...parentForm, isPrimary: e.target.checked })}
                  />
                  Primary contact
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddParent}
                  disabled={!parentForm.name || !parentForm.phone || !parentForm.relationship || savingParent}
                >
                  {savingParent ? "Adding..." : "Add Parent"}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function parseSimpleCsv(text: string): Record<string, unknown>[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(",").map((v) => v.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => { row[header] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}
