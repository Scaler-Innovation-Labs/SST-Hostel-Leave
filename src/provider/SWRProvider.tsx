"use client";

import { SWRConfig } from "swr";
import { ReactNode } from "react";

interface SWRProviderProps {
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
        revalidateOnFocus: false, // Don't refetch on window focus for performance
        revalidateIfStale: false, // Only revalidate on mount or manual trigger
        dedupingInterval: 5000, // Dedupe requests within 5s window
        errorRetryCount: 2, // Retry failed requests twice
        keepPreviousData: true, // Keep showing old data while fetching new
      }}
    >
      {children}
    </SWRConfig>
  );
}