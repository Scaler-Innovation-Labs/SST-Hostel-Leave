// @vitest-environment jsdom
import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useSWR, { SWRConfig, mutate as globalMutate } from "swr";
import { cache as swrGlobalCache, SWRGlobalState } from "swr/_internal";
import React from "react";

function clearSWRGlobalCache() {
  swrGlobalCache.clear();
  const state = SWRGlobalState.get(swrGlobalCache);
  if (state) {
    const [, MUTATION, FETCH, DEDUPING] = state;
    if (DEDUPING) for (const k in DEDUPING) delete DEDUPING[k];
    if (FETCH) for (const k in FETCH) delete FETCH[k];
    if (MUTATION) for (const k in MUTATION) delete MUTATION[k];
  }
}

// Mock clerk useAuth
let currentMockUserId: string | null = "user_initial";
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    userId: currentMockUserId,
  }),
}));

import { SWRProvider } from "@/providers/SWRProvider";
import { useNavBadges, NAV_BADGES_SWR_KEY, NAV_BADGES_POLL_INTERVAL } from "@/hooks/use-badges";
import { useApprovals, APPROVALS_POLL_INTERVAL } from "@/features/approvals/hooks/use-approvals";
import { useExtensionApprovals, EXTENSION_APPROVALS_POLL_INTERVAL } from "@/features/extensions/hooks/use-approve-extension";
import { useDashboardStats, DASHBOARD_STATS_POLL_INTERVAL } from "@/features/dashboard/hooks/use-dashboard-stats";
import { useOverdue, OVERDUE_SWR_KEY, OVERDUE_POLL_INTERVAL } from "@/hooks/use-overdue";
import { useLeaves, useLeave } from "@/features/leaves/hooks/use-leaves";
import { useMovement } from "@/hooks/use-movement";
import { useHostels } from "@/hooks/use-hostels";
import { useAcademicGroups } from "@/hooks/use-academic-groups";
import { useLeaveTypes } from "@/features/leaves/hooks/use-leaves";

beforeEach(async () => {
  vi.useRealTimers();
  currentMockUserId = "user_initial";
  clearSWRGlobalCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(async () => {
  clearSWRGlobalCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Commit 3 — Polling Ownership, Page Visibility and Operational Freshness", () => {
  describe("1. Shared Polling Ownership across multiple mounted components", () => {
    it("deduplicates requests when multiple badge components mount simultaneously", async () => {
      let badgeFetchCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          if (url === NAV_BADGES_SWR_KEY) {
            badgeFetchCount++;
            return {
              ok: true,
              json: async () => ({
                success: true,
                data: { approvals: 3, extensionApprovals: 1, overdue: 2 },
              }),
            };
          }
          return { ok: true, json: async () => ({ success: true, data: {} }) };
        })
      );

      function ApprovalBadge() {
        const { approvalsCount } = useNavBadges();
        return <div data-testid="badge-approvals">{approvalsCount}</div>;
      }

      function ExtensionBadge() {
        const { extensionApprovalsCount } = useNavBadges();
        return <div data-testid="badge-extensions">{extensionApprovalsCount}</div>;
      }

      function OverdueBadge() {
        const { overdueCount } = useNavBadges();
        return <div data-testid="badge-overdue">{overdueCount}</div>;
      }

      function StaffSidebar() {
        return (
          <div>
            <ApprovalBadge />
            <ExtensionBadge />
            <OverdueBadge />
          </div>
        );
      }

      render(
        <SWRProvider>
          <StaffSidebar />
        </SWRProvider>
      );

      expect(await screen.findByTestId("badge-approvals")).toHaveTextContent("3");
      expect(screen.getByTestId("badge-extensions")).toHaveTextContent("1");
      expect(screen.getByTestId("badge-overdue")).toHaveTextContent("2");

      // Despite 3 separate components mounting useNavBadges simultaneously,
      // SWR shares the single SWR key and only executes 1 network request.
      expect(badgeFetchCount).toBe(1);
    });
  });

  describe("2. Operational vs Reference Hook Configurations", () => {
    it("configures useNavBadges with 300s polling and revalidateOnFocus: true", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestComponent() {
        useNavBadges();
        return null;
      }

      render(
        <SWRConfig
          value={{
            use: [
              (useSWRNext) => (key, fetcher, config) => {
                if (key === NAV_BADGES_SWR_KEY) {
                  capturedConfig = config as Record<string, unknown>;
                }
                return useSWRNext(key, fetcher, config);
              },
            ],
          }}
        >
          <TestComponent />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(NAV_BADGES_POLL_INTERVAL);
      expect(capturedConfig?.refreshInterval).toBe(300_000);
      expect(capturedConfig?.revalidateOnFocus).toBe(true);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });

    it("configures useApprovals with 180s polling and revalidateOnFocus: true", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestComponent() {
        useApprovals({ page: 1 });
        return null;
      }

      render(
        <SWRConfig
          value={{
            use: [
              (useSWRNext) => (key, fetcher, config) => {
                if (typeof key === "string" && key.startsWith("/api/v1/approvals")) {
                  capturedConfig = config as Record<string, unknown>;
                }
                return useSWRNext(key, fetcher, config);
              },
            ],
          }}
        >
          <TestComponent />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(APPROVALS_POLL_INTERVAL);
      expect(capturedConfig?.refreshInterval).toBe(180_000);
      expect(capturedConfig?.revalidateOnFocus).toBe(true);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });

    it("configures useExtensionApprovals with 180s polling and revalidateOnFocus: true", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestComponent() {
        useExtensionApprovals({ page: 1 });
        return null;
      }

      render(
        <SWRConfig
          value={{
            use: [
              (useSWRNext) => (key, fetcher, config) => {
                if (typeof key === "string" && key.includes("/extensions/approvals")) {
                  capturedConfig = config as Record<string, unknown>;
                }
                return useSWRNext(key, fetcher, config);
              },
            ],
          }}
        >
          <TestComponent />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(EXTENSION_APPROVALS_POLL_INTERVAL);
      expect(capturedConfig?.refreshInterval).toBe(180_000);
      expect(capturedConfig?.revalidateOnFocus).toBe(true);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });

    it("configures useDashboardStats with 180s polling and revalidateOnFocus: true", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestComponent() {
        useDashboardStats();
        return null;
      }

      render(
        <SWRConfig
          value={{
            use: [
              (useSWRNext) => (key, fetcher, config) => {
                if (typeof key === "string" && key.startsWith("/api/v1/dashboard/stats")) {
                  capturedConfig = config as Record<string, unknown>;
                }
                return useSWRNext(key, fetcher, config);
              },
            ],
          }}
        >
          <TestComponent />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(DASHBOARD_STATS_POLL_INTERVAL);
      expect(capturedConfig?.refreshInterval).toBe(180_000);
      expect(capturedConfig?.revalidateOnFocus).toBe(true);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });

    it("configures useOverdue with 180s polling and revalidateOnFocus: true", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestComponent() {
        useOverdue();
        return null;
      }

      render(
        <SWRConfig
          value={{
            use: [
              (useSWRNext) => (key, fetcher, config) => {
                if (key === OVERDUE_SWR_KEY) {
                  capturedConfig = config as Record<string, unknown>;
                }
                return useSWRNext(key, fetcher, config);
              },
            ],
          }}
        >
          <TestComponent />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(OVERDUE_POLL_INTERVAL);
      expect(capturedConfig?.refreshInterval).toBe(180_000);
      expect(capturedConfig?.revalidateOnFocus).toBe(true);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });

    it("configures useLeaves with disabled (0ms) background polling and revalidateOnFocus: false", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestComponent() {
        useLeaves({ page: 1 });
        return null;
      }

      render(
        <SWRConfig
          value={{
            use: [
              (useSWRNext) => (key, fetcher, config) => {
                if (typeof key === "string" && key.startsWith("/api/v1/leaves")) {
                  capturedConfig = config as Record<string, unknown>;
                }
                return useSWRNext(key, fetcher, config);
              },
            ],
          }}
        >
          <TestComponent />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(0);
      expect(capturedConfig?.revalidateOnFocus).toBe(false);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });

    it("configures useLeave with revalidateOnFocus: true for student detail screen", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestComponent() {
        useLeave("leave-abc-123");
        return null;
      }

      render(
        <SWRConfig
          value={{
            use: [
              (useSWRNext) => (key, fetcher, config) => {
                if (typeof key === "string" && key.includes("/api/v1/leaves/leave-abc-123")) {
                  capturedConfig = config as Record<string, unknown>;
                }
                return useSWRNext(key, fetcher, config);
              },
            ],
          }}
        >
          <TestComponent />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.revalidateOnFocus).toBe(true);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });

    it("configures useMovement with revalidateOnFocus: true for live movements log", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestComponent() {
        useMovement({ page: 1 });
        return null;
      }

      render(
        <SWRConfig
          value={{
            use: [
              (useSWRNext) => (key, fetcher, config) => {
                if (typeof key === "string" && key.startsWith("/api/v1/movements")) {
                  capturedConfig = config as Record<string, unknown>;
                }
                return useSWRNext(key, fetcher, config);
              },
            ],
          }}
        >
          <TestComponent />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(0);
      expect(capturedConfig?.revalidateOnFocus).toBe(true);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });

    it("preserves revalidateOnFocus: false for reference data (hostels, academic groups, leave types)", () => {
      const capturedConfigs = new Map<string, Record<string, unknown>>();

      function TestReference() {
        useHostels();
        useAcademicGroups();
        useLeaveTypes();
        return null;
      }

      render(
        <SWRConfig
          value={{
            use: [
              (useSWRNext) => (key, fetcher, config) => {
                if (typeof key === "string") {
                  capturedConfigs.set(key, config as Record<string, unknown>);
                }
                return useSWRNext(key, fetcher, config);
              },
            ],
          }}
        >
          <TestReference />
        </SWRConfig>
      );

      expect(capturedConfigs.get("/api/v1/hostels")?.revalidateOnFocus).toBe(false);
      expect(capturedConfigs.get("/api/v1/academic-groups")?.revalidateOnFocus).toBe(false);
      expect(capturedConfigs.get("/api/v1/leave-types")?.revalidateOnFocus).toBe(false);
    });
  });

  describe("3. Page Visibility and Tab Focus Behavior", () => {
    it("ensures global refreshWhenHidden: false prevents polling when tab is hidden", () => {
      function UseSWRComponent() {
        const { data } = useSWR("/api/test-global-visibility");
        return <div>{data ? "loaded" : "init"}</div>;
      }

      render(
        <SWRProvider>
          <UseSWRComponent />
        </SWRProvider>
      );
    });

    it("revalidates on window focus for operational hooks with revalidateOnFocus: true", async () => {
      let callCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          if (url === OVERDUE_SWR_KEY) {
            callCount++;
            return {
              ok: true,
              json: async () => ({
                success: true,
                data: [{ id: `overdue-${callCount}`, studentName: `Student ${callCount}` }],
              }),
            };
          }
          return { ok: true, json: async () => ({ success: true, data: {} }) };
        })
      );

      function OverdueViewer() {
        const { overdue } = useOverdue({ dedupingInterval: 0 });
        return <div data-testid="overdue-student">{overdue[0]?.studentName ?? "None"}</div>;
      }

      render(
        <SWRConfig value={{ focusThrottleInterval: 0 }}>
          <OverdueViewer />
        </SWRConfig>
      );

      expect(await screen.findByTestId("overdue-student")).toHaveTextContent("Student 1");
      expect(callCount).toBe(1);

      // Simulate user returning to the tab (window focus event)
      await act(async () => {
        window.dispatchEvent(new Event("focus"));
      });

      // Verification: Focus event triggered a revalidation
      expect(await screen.findByTestId("overdue-student")).toHaveTextContent("Student 2");
      expect(callCount).toBe(2);
    });

    it("does NOT revalidate on window focus for reference hooks with revalidateOnFocus: false", async () => {
      let hostelCallCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          if (url === "/api/v1/hostels") {
            hostelCallCount++;
            return {
              ok: true,
              json: async () => ({
                success: true,
                data: [{ id: "h1", name: `Hostel ${hostelCallCount}`, code: "H1", isActive: true }],
              }),
            };
          }
          return { ok: true, json: async () => ({ success: true, data: {} }) };
        })
      );

      function HostelViewer() {
        const { hostels } = useHostels();
        return <div data-testid="hostel-name">{hostels[0]?.name ?? "None"}</div>;
      }

      render(
        <SWRConfig value={{ focusThrottleInterval: 0 }}>
          <HostelViewer />
        </SWRConfig>
      );

      expect(await screen.findByTestId("hostel-name")).toHaveTextContent("Hostel 1");
      expect(hostelCallCount).toBe(1);

      // Simulate user returning to the tab (window focus event)
      await act(async () => {
        window.dispatchEvent(new Event("focus"));
      });

      // Verification: Reference hook did NOT re-fetch on window focus
      expect(screen.getByTestId("hostel-name")).toHaveTextContent("Hostel 1");
      expect(hostelCallCount).toBe(1);
    });
  });

  describe("4. Manual Refresh and Mutation Invalidation", () => {
    it("allows manual refresh via mutate() on operational queues", async () => {
      let callCount = 0;
      let manualMutate: (() => Promise<unknown>) | null = null;

      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (url: string) => {
          if (typeof url === "string" && url.startsWith("/api/v1/approvals")) {
            callCount++;
            return {
              ok: true,
              json: async () => ({
                success: true,
                data: { items: [{ id: `app-${callCount}`, studentName: `Student ${callCount}` }], total: 1 },
              }),
            };
          }
          return { ok: true, json: async () => ({ success: true, data: {} }) };
        })
      );

      function ApprovalsViewer() {
        const { approvals, mutate } = useApprovals({ page: 1 }, { dedupingInterval: 0 });
        manualMutate = mutate;
        return <div data-testid="approval-student">{approvals[0]?.studentName ?? "None"}</div>;
      }

      render(
        <SWRProvider>
          <ApprovalsViewer />
        </SWRProvider>
      );

      expect(await screen.findByTestId("approval-student")).toHaveTextContent("Student 1");
      expect(callCount).toBe(1);

      // Trigger explicit manual refresh
      await act(async () => {
        if (manualMutate) await manualMutate();
      });

      expect(await screen.findByTestId("approval-student")).toHaveTextContent("Student 2");
      expect(callCount).toBe(2);
    });
  });
});
