"use client";

import { useState } from "react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLE_OPTIONS = [
  { value: "STUDENT", label: "Student" },
  { value: "POC", label: "POC" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "GUARD", label: "Guard" },
];

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

// Roles that can be restricted to specific hostels.
const SCOPABLE_ROLES = ["ADMIN", "POC"];

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((r) => r.data ?? r);

type HostelOption = { id: string; name: string; code: string };

export type UserRoleScopeField = {
  roleCode: string;
  hostelIds: string[];
};

export type UserFormData = {
  fullName: string;
  email: string;
  phone: string;
  slackId: string;
  gender: string;
  hostelId: string;
  roleCodes: string[];
  roleScopes: UserRoleScopeField[];
  isActive: boolean;
};

type UserFormProps = {
  initialData?: Partial<UserFormData>;
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  mode: "create" | "edit";
};

function scopesToMap(roleScopes?: UserRoleScopeField[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const { roleCode, hostelIds } of roleScopes ?? []) {
    map[roleCode] = hostelIds;
  }
  return map;
}

export function UserForm({ initialData, onSubmit, onCancel, isLoading, mode }: UserFormProps) {
  const [fullName, setFullName] = useState(initialData?.fullName ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [slackId, setSlackId] = useState(initialData?.slackId ?? "");
  const [gender, setGender] = useState(initialData?.gender ?? "");
  const [roleCodes, setRoleCodes] = useState<string[]>(initialData?.roleCodes ?? []);
  const [roleScopes, setRoleScopes] = useState<Record<string, string[]>>(
    () => scopesToMap(initialData?.roleScopes)
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const { data: hostels } = useSWR<HostelOption[]>("/api/v1/hostels", fetcher);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }

    if (roleCodes.length === 0) {
      setError("At least one role is required");
      return;
    }

    const scopedRoleCodes = roleCodes.filter((code) => SCOPABLE_ROLES.includes(code));

    await onSubmit({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      slackId: slackId.trim(),
      gender,
      hostelId: initialData?.hostelId ?? "",
      roleCodes,
      roleScopes: scopedRoleCodes.map((code) => ({
        roleCode: code,
        hostelIds: roleScopes[code] ?? [],
      })),
      isActive,
    });
  };

  const toggleRole = (code: string) => {
    const next = roleCodes.includes(code)
      ? roleCodes.filter((r) => r !== code)
      : [...roleCodes, code];
    setRoleCodes(next);

    // Drop scope entries for roles that were removed.
    if (roleCodes.includes(code)) {
      const { [code]: _removed, ...rest } = roleScopes;
      setRoleScopes(rest);
    }
  };

  const toggleHostel = (roleCode: string, hostelId: string) => {
    setRoleScopes((prev) => {
      const current = prev[roleCode] ?? [];
      const next = current.includes(hostelId)
        ? current.filter((id) => id !== hostelId)
        : [...current, hostelId];
      return { ...prev, [roleCode]: next };
    });
  };

  const scopableSelectedRoles = roleCodes.filter((code) => SCOPABLE_ROLES.includes(code));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter full name"
            required
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+911234567890"
          />
        </div>

        <div>
          <Label htmlFor="slackId">Slack ID</Label>
          <Input
            id="slackId"
            value={slackId}
            onChange={(e) => setSlackId(e.target.value)}
            placeholder="U0123AB456"
            className="font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Used for Slack mentions/DMs. Find it in the Slack member profile menu.
          </p>
        </div>

        <div>
          <Label htmlFor="gender">Gender</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === "create" && (
          <div>
            <Label>Status</Label>
            <Select value={isActive ? "true" : "false"} onValueChange={(value: string) => setIsActive(value === "true")}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {(mode === "create" || mode === "edit") && (
        <div>
          <Label className="mb-2 block">Roles {mode === "create" && "*"}</Label>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => toggleRole(role.value)}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  roleCodes.includes(role.value)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {roleCodes.includes(role.value) && (
                  <span className="mr-1.5 h-2 w-2 rounded-full bg-primary" />
                )}
                {role.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {scopableSelectedRoles.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <Label className="mb-1 block">Hostel Scope</Label>
          <p className="mb-3 text-xs text-muted-foreground">
            Restrict each {scopableSelectedRoles.join(" / ")} role to specific hostels. Unchecked
            = access to all hostels.
          </p>
          {scopableSelectedRoles.map((roleCode) => {
            const roleLabel = ROLE_OPTIONS.find((r) => r.value === roleCode)?.label ?? roleCode;
            const selected = roleScopes[roleCode] ?? [];
            return (
              <div key={roleCode} className="rounded-lg border border-border bg-background p-3">
                <p className="mb-2 text-sm font-medium">{roleLabel}</p>
                {hostels?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {hostels.map((hostel) => {
                      const checked = selected.includes(hostel.id);
                      return (
                        <button
                          key={hostel.id}
                          type="button"
                          onClick={() => toggleHostel(roleCode, hostel.id)}
                          className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            checked
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {checked && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-primary" />}
                          {hostel.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Unrestricted (all hostels)
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mode === "edit" && (
        <div>
          <Label className="mb-2 block">Status</Label>
          <Select value={isActive ? "true" : "false"} onValueChange={(value: string) => setIsActive(value === "true")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}