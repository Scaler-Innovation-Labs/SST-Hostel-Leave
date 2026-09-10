"use client";

import { useAuth } from "@clerk/nextjs";
import { type ReactNode,useEffect, useRef } from "react";
import { SWRConfig, useSWRConfig } from "swr";

type SWRProviderProps = {
  children: ReactNode;
}

// Global fetcher for SWR - optimized with proper error handling
const globalFetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
};

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher: globalFetcher,
        revalidateOnFocus: false,
        revalidateIfStale: false,
        revalidateOnMount: true,
        dedupingInterval: 10_000,
        errorRetryCount: 2,
        keepPreviousData: true,
      }}
    >
      <IdentityCacheClearer />
      {children}
    </SWRConfig>
  );
}

/**
 * The provider lives in the root layout, so its cache survives sign-out
 * and account switches within one browser session. Role-scoped lists
 * (approvals, movements, dashboard stats) from the previous identity
 * would otherwise render for the next one until remount. Clear on
 * identity change — never on first load.
 */
function IdentityCacheClearer(): ReactNode {
  const { userId } = useAuth();
  const { mutate } = useSWRConfig();
  const previousUserId = useRef<string | null | undefined>(userId);

  useEffect(() => {
    if (previousUserId.current && previousUserId.current !== userId) {
      void mutate(
        () => true,
        undefined,
        { revalidate: false }
      );
    }
    previousUserId.current = userId;
  }, [userId, mutate]);

  return null;
}