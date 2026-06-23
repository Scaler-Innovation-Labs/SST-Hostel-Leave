"use client";

import { Building2, GraduationCap, Hotel, Plus, Save, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { PolicyConfigBuilder } from "@/components/policies/PolicyConfigBuilder";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { POLICY_TYPES } from "@/dto/policy/save-policy.dto";
import { useLeaveTypes } from "@/features/leaves/hooks/use-leaves";
import { usePolicies } from "@/hooks/use-policies";
import { savePolicy } from "@/lib/api/policy-api";
import { cn } from "@/lib/utils";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((r) => r.data ?? r);

type DepartmentItem = {
  id: string;
  code: string;
  name: string;
};

type HostelItem = {
  id: string;
  code: string;
  name: string;
};

const POLICY_TYPE_LABELS: Record<string, string> = {
  MAX_DAYS: "Max Days",
  BLOCK_DURING_PERIOD: "Block During Period",
  RESTRICT_BATCH: "Restrict Batch",
  REQUIRE_PARENT_APPROVAL: "Require Parent Approval",
  CURFEW_RESTRICTION: "Curfew Restriction",
  MAX_EXTENSION_COUNT: "Max Extension Count",
  FORM_FIELD_RESTRICTION: "Form Field Restriction",
};

const POLICY_TYPE_DESCRIPTIONS: Record<string, string> = {
  MAX_DAYS: "Limit the maximum number of days for a leave",
  BLOCK_DURING_PERIOD: "Block leave requests during specific periods",
  RESTRICT_BATCH: "Restrict leave for specific batch years",
  REQUIRE_PARENT_APPROVAL: "Require parent approval for leave requests",
  CURFEW_RESTRICTION: "Set a curfew for return time",
  MAX_EXTENSION_COUNT: "Limit the number of extensions allowed",
  FORM_FIELD_RESTRICTION: "Restrict form field values or visibility",
};

const POLICY_TYPE_COLORS: Record<string, string> = {
  MAX_DAYS: "border-l-blue-500 bg-blue-500/5",
  BLOCK_DURING_PERIOD: "border-l-amber-500 bg-amber-500/5",
  RESTRICT_BATCH: "border-l-violet-500 bg-violet-500/5",
  REQUIRE_PARENT_APPROVAL: "border-l-rose-500 bg-rose-500/5",
  CURFEW_RESTRICTION: "border-l-emerald-500 bg-emerald-500/5",
  MAX_EXTENSION_COUNT: "border-l-cyan-500 bg-cyan-500/5",
  FORM_FIELD_RESTRICTION: "border-l-orange-500 bg-orange-500/5",
};

type PolicyItem = {
  id: string;
  name: string;
  policyType: string;
  priority: number;
  leaveTypeId: string | null;
  hostelId: string | null;
  departmentId: string | null;
  batchYear: number | null;
  config: Record<string, unknown>;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LeaveTypeItem = {
  id: string;
  name: string;
  code: string;
};

const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  MAX_DAYS: { maxDays: 7 },
  BLOCK_DURING_PERIOD: { blockedPeriods: [] },
  RESTRICT_BATCH: { blockedBatchYears: [] },
  REQUIRE_PARENT_APPROVAL: {},
  CURFEW_RESTRICTION: { latestReturnTime: "22:00" },
  MAX_EXTENSION_COUNT: { maxExtensionCount: 3 },
  FORM_FIELD_RESTRICTION: {},
};

type PolicyDraft = {
  id?: string;
  name: string;
  policyType: string;
  priority: number;
  leaveTypeId: string | null;
  hostelId: string;
  departmentId: string;
  batchYear: string;
  config: Record<string, unknown>;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const EMPTY_DRAFT: PolicyDraft = {
  name: "",
  policyType: "MAX_DAYS",
  priority: 0,
  leaveTypeId: null,
  hostelId: "",
  departmentId: "",
  batchYear: "",
  config: { maxDays: 7 },
  isActive: true,
  startsAt: "",
  endsAt: "",
};

export default function PoliciesPage() {
  const { policies, isLoading, isError, error, mutate } = usePolicies();
  const { leaveTypes } = useLeaveTypes();
  const { data: departments } = useSWR<DepartmentItem[]>("/api/v1/departments", fetcher);
  const { data: hostels } = useSWR<HostelItem[]>("/api/v1/hostels", fetcher);
  const [draft, setDraft] = useState<PolicyDraft>(EMPTY_DRAFT);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [saving, setSaving] = useState(false);

  const typedPolicies = useMemo(() => policies as PolicyItem[], [policies]);
  const typedLeaveTypes = useMemo(() => leaveTypes as LeaveTypeItem[], [leaveTypes]);
  const typedDepartments = useMemo(() => departments ?? [], [departments]);
  const typedHostels = useMemo(() => hostels ?? [], [hostels]);

  const deptNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of typedDepartments) map[d.id] = d.name;
    return map;
  }, [typedDepartments]);

  const hostelNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const h of typedHostels) map[h.id] = h.name;
    return map;
  }, [typedHostels]);

  const leaveTypeNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const lt of typedLeaveTypes) map[lt.id] = lt.name;
    return map;
  }, [typedLeaveTypes]);

  const edit = (policy: PolicyItem) => {
    setDraft({
      id: policy.id,
      name: policy.name,
      policyType: policy.policyType,
      priority: policy.priority,
      leaveTypeId: policy.leaveTypeId,
      hostelId: policy.hostelId ?? "",
      departmentId: policy.departmentId ?? "",
      batchYear: policy.batchYear != null ? String(policy.batchYear) : "",
      config: (typeof policy.config === "object" && policy.config ? policy.config : {}) as Record<string, unknown>,
      isActive: policy.isActive,
      startsAt: policy.startsAt ? String(policy.startsAt).slice(0, 16) : "",
      endsAt: policy.endsAt ? String(policy.endsAt).slice(0, 16) : "",
    });
    setMessage(null);
  };

  const startNew = () => {
    setDraft(EMPTY_DRAFT);
    setMessage(null);
  };

  const handlePolicyTypeChange = (newType: string) => {
    setDraft({
      ...draft,
      policyType: newType,
      config: DEFAULT_CONFIGS[newType] ?? {},
    });
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      setMessage("Policy name is required.");
      setMessageType("error");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        ...draft,
        hostelId: draft.hostelId || null,
        departmentId: draft.departmentId || null,
        batchYear: draft.batchYear ? Number(draft.batchYear) : null,
        startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
        endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
      };
      await savePolicy(payload, draft.id);
      await mutate();
      setDraft(EMPTY_DRAFT);
      setMessage("Policy saved successfully.");
      setMessageType("success");
    } catch (saveError) {
      setMessage(
        saveError instanceof Error ? saveError.message : "Failed to save policy",
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  if (isError) {
    return (
      <ErrorState
        message={error?.message ?? "Failed to load policies"}
        onRetry={() => mutate()}
      />
    );
  }

  const isEditing = !!draft.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy Studio"
        description="Configure scoped, prioritized rules evaluated during leave and extension requests."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        {/* Policy list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Policies
              {typedPolicies.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({typedPolicies.length})
                </span>
              )}
            </h2>
            <Button variant="outline" size="sm" onClick={startNew}>
              <Plus className="mr-1 h-4 w-4" />
              New
            </Button>
          </div>

          {isLoading ? (
            <LoadingState count={5} />
          ) : typedPolicies.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <p className="text-sm text-muted-foreground">No policies yet.</p>
              <p className="text-xs text-muted-foreground">
                Create your first policy to start configuring rules.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {typedPolicies.map((policy) => (
                <button
                  key={policy.id}
                  onClick={() => edit(policy)}
                  className={cn(
                    "w-full rounded-xl border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-sm",
                    "border-l-4",
                    POLICY_TYPE_COLORS[policy.policyType] ?? "border-l-muted",
                    draft.id === policy.id
                      ? "border-primary ring-1 ring-primary"
                      : "",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{policy.name}</span>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {POLICY_TYPE_LABELS[policy.policyType] ?? policy.policyType}
                        <span className="mx-1.5">·</span>
                        priority {policy.priority}
                      </p>
                      {(policy.leaveTypeId || policy.hostelId || policy.departmentId || policy.batchYear != null) && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {policy.leaveTypeId && leaveTypeNameById[policy.leaveTypeId] && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                              <Tag className="h-3 w-3" />
                              {leaveTypeNameById[policy.leaveTypeId]}
                            </span>
                          )}
                          {policy.hostelId && hostelNameById[policy.hostelId] && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                              <Hotel className="h-3 w-3" />
                              {hostelNameById[policy.hostelId]}
                            </span>
                          )}
                          {policy.departmentId && deptNameById[policy.departmentId] && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                              <Building2 className="h-3 w-3" />
                              {deptNameById[policy.departmentId]}
                            </span>
                          )}
                          {policy.batchYear != null && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-600 dark:text-cyan-400">
                              <GraduationCap className="h-3 w-3" />
                              Batch {policy.batchYear}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        policy.isActive
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {policy.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Policy editor */}
        <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-semibold">
                {isEditing ? "Edit Policy" : "New Policy"}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isEditing
                  ? "Update the policy configuration below."
                  : "Fill in the details to create a new policy."}
              </p>
            </div>
            {isEditing && (
              <Button variant="ghost" size="sm" onClick={startNew}>
                Discard
              </Button>
            )}
          </div>

          {/* Name */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Name
              </span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Home Pass Max Days"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Policy Type
              </span>
              <select
                value={draft.policyType}
                onChange={(e) => handlePolicyTypeChange(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
              >
                {POLICY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {POLICY_TYPE_LABELS[type] ?? type}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                {POLICY_TYPE_DESCRIPTIONS[draft.policyType] ?? ""}
              </p>
            </label>
          </div>

          {/* Priority + Leave Type + Hostel + Department + Batch Year */}
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Priority
              </span>
              <input
                type="number"
                min={0}
                max={10000}
                value={String(draft.priority)}
                onChange={(e) =>
                  setDraft({ ...draft, priority: Number(e.target.value) })
                }
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Leave Type
              </span>
              <select
                value={draft.leaveTypeId ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, leaveTypeId: e.target.value || null })
                }
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
              >
                <option value="">All leave types</option>
                {typedLeaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Hostel
              </span>
              <select
                value={draft.hostelId}
                onChange={(e) =>
                  setDraft({ ...draft, hostelId: e.target.value })
                }
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
              >
                <option value="">All hostels</option>
                {typedHostels.map((hostel) => (
                  <option key={hostel.id} value={hostel.id}>
                    {hostel.name} ({hostel.code})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Leave empty to apply to all hostels
              </p>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Department
              </span>
              <select
                value={draft.departmentId}
                onChange={(e) =>
                  setDraft({ ...draft, departmentId: e.target.value })
                }
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
              >
                <option value="">All departments</option>
                {typedDepartments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Leave empty to apply to all departments
              </p>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Batch Year
              </span>
              <input
                type="number"
                min={1900}
                max={2100}
                value={draft.batchYear}
                onChange={(e) =>
                  setDraft({ ...draft, batchYear: e.target.value })
                }
                placeholder="e.g. 2028"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground">
                Leave empty to apply to all batches
              </p>
            </label>
          </div>

          {/* Visual config builder */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Policy Configuration
            </p>
            <PolicyConfigBuilder
              policyType={draft.policyType}
              config={draft.config}
              onChange={(config) => setDraft({ ...draft, config })}
            />
          </div>

          {/* Date range */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Starts at
              </span>
              <input
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) =>
                  setDraft({ ...draft, startsAt: e.target.value })
                }
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Ends at
              </span>
              <input
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) =>
                  setDraft({ ...draft, endsAt: e.target.value })
                }
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>

          {/* Active toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) =>
                setDraft({ ...draft, isActive: e.target.checked })
              }
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>Active</span>
          </label>

          {/* Message */}
          {message && (
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                messageType === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {message}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end border-t border-border pt-4">
            <Button
              onClick={submit}
              disabled={saving || !draft.name.trim()}
            >
              <Save className="mr-1.5 h-4 w-4" />
              {saving
                ? "Saving..."
                : isEditing
                  ? "Update Policy"
                  : "Create Policy"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
