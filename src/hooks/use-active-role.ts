"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";

import { fetcher } from "@/lib/api/fetcher";
import type { Role } from "@/lib/auth/roles";

export type MyRoleEntry = {
  role: Role;
  label: string;
  dashboardHref: string;
};

export type MyRolesResponse = {
  roles: MyRoleEntry[];
  activeRole: Role | null;
};

export function useActiveRole() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<MyRolesResponse>(
    "/api/v1/me/roles",
    fetcher
  );

  const switchRole = async (role: Role): Promise<string> => {
    const res = await fetch("/api/v1/me/active-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (!res.ok || json.success !== true) {
      throw new Error(json.error?.message ?? "Could not switch role");
    }
    const dashboardHref = (json.data.dashboardHref as string) ?? "/";
    await mutate();
    router.push(dashboardHref);
    router.refresh();
    return dashboardHref;
  };

  return {
    roles: data?.roles ?? [],
    activeRole: data?.activeRole ?? null,
    isLoading,
    error,
    switchRole,
    mutate,
  };
}
