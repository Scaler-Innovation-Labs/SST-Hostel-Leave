// @vitest-environment jsdom
import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useSWR, { SWRConfig, mutate as globalMutate } from "swr";
import React from "react";

// Mock clerk useAuth
let currentMockUserId: string | null = "user_initial";
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    userId: currentMockUserId,
  }),
}));

import { SWRProvider } from "@/providers/SWRProvider";
import { useNavBadges } from "@/hooks/use-badges";
import { useApprovals } from "@/features/approvals/hooks/use-approvals";
import { useLeaves, useLeave, useLeaveTypes } from "@/features/leaves/hooks/use-leaves";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";
import { useExtensionApprovals } from "@/features/extensions/hooks/use-approve-extension";
import { createLeave, cancelLeave } from "@/lib/api/leave-api";
import { approveLeave, rejectLeave, superadminOverrideLeave } from "@/lib/api/approval-api";

beforeEach(async () => {
  vi.useRealTimers();
  currentMockUserId = "user_initial";
  await globalMutate(() => true, undefined, { revalidate: false });
});

afterEach(async () => {
  await globalMutate(() => true, undefined, { revalidate: false });
  vi.restoreAllMocks();
});

describe("Commit 1 — SWR Configuration, Polling and Workflow Freshness", () => {
  describe("1. SWRProvider mount and cache reuse behavior", () => {
    it("fetches on initial mount when cache is empty, but reuses cache on remount without refetching", async () => {
      let fetchCount = 0;
      const fetcher = vi.fn().mockImplementation(async () => {
        fetchCount++;
        return { message: "hello" };
      });

      function TestComponent() {
        const { data } = useSWR("/api/test-cache-reuse", fetcher);
        return <div>{data?.message ?? "loading"}</div>;
      }

      // First mount: empty cache -> fetches
      const { unmount } = render(
        <SWRProvider>
          <TestComponent />
        </SWRProvider>
      );

      await screen.findByText("hello");
      expect(fetchCount).toBe(1);

      // Unmount component
      unmount();

      // Second mount: cached data exists -> reuses without refetching
      render(
        <SWRProvider>
          <TestComponent />
        </SWRProvider>
      );

      expect(screen.getByText("hello")).toBeInTheDocument();
      expect(fetchCount).toBe(1);
    });

    it("revalidates immediately when mutate() is called manually", async () => {
      let count = 0;
      let mutateTrigger: (() => Promise<unknown>) | null = null;

      function TestManual() {
        const { data, mutate } = useSWR("/api/test-manual", async () => {
          count++;
          return { count };
        });
        mutateTrigger = mutate;
        return <div>Count: {data?.count ?? 0}</div>;
      }

      render(
        <SWRProvider>
          <TestManual />
        </SWRProvider>
      );

      await screen.findByText("Count: 1");

      await act(async () => {
        if (mutateTrigger) await mutateTrigger();
      });

      await screen.findByText("Count: 2");
    });

    it("clears cached data when Clerk userId changes", async () => {
      function TestIdentity() {
        const { data } = useSWR("/api/user-profile-id", async () => {
          return { user: "alice" };
        });
        return <div>User: {data?.user ?? "none"}</div>;
      }

      function AppWrapper({ showComponent }: { showComponent: boolean }) {
        return (
          <SWRProvider>
            {showComponent && <TestIdentity />}
          </SWRProvider>
        );
      }

      const { rerender } = render(<AppWrapper showComponent={true} />);
      await screen.findByText("User: alice");

      // Switch Clerk user ID and unmount component (simulate logout / route transition)
      currentMockUserId = "user_bob";
      await act(async () => {
        rerender(<AppWrapper showComponent={false} />);
      });

      // When component remounts under bob, alice's data is gone
      await act(async () => {
        rerender(<AppWrapper showComponent={true} />);
      });

      // Previous user data was cleared from cache, so alice is not rendered
      expect(screen.queryByText("User: alice")).toBeNull();
      expect(screen.getByText("User: none")).toBeDefined();
    });
  });

  describe("2. Polling interval configurations", () => {
    it("configures useNavBadges with 300s (300,000ms) polling and 30s dedupingInterval", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestBadgeHook() {
        useNavBadges();
        return null;
      }

      render(
        <SWRConfig
          value={{
            use: [
              (useSWRNext) => (key, fetcher, config) => {
                if (key === "/api/v1/badges") {
                  capturedConfig = config as Record<string, unknown>;
                }
                return useSWRNext(key, fetcher, config);
              },
            ],
          }}
        >
          <TestBadgeHook />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(300_000);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });

    it("configures useApprovals with 180s (180,000ms) polling and 30s dedupingInterval", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestApprovalsHook() {
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
          <TestApprovalsHook />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(180_000);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });

    it("configures useLeaves with disabled (0ms) passive polling by default and 30s deduping", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestLeavesHook() {
        useLeaves({ page: 1, limit: 10 });
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
          <TestLeavesHook />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(0);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });

    it("configures useLeave detail and useLeaveTypes with 30s deduping and no forced revalidateOnMount", () => {
      let leaveConfig: Record<string, unknown> | null = null;
      let typesConfig: Record<string, unknown> | null = null;

      function TestDetailHooks() {
        useLeave("leave-abc");
        useLeaveTypes();
        return null;
      }

      render(
        <SWRConfig
          value={{
            use: [
              (useSWRNext) => (key, fetcher, config) => {
                if (typeof key === "string" && key.includes("/leaves/leave-abc")) {
                  leaveConfig = config as Record<string, unknown>;
                }
                if (key === "/api/v1/leave-types") {
                  typesConfig = config as Record<string, unknown>;
                }
                return useSWRNext(key, fetcher, config);
              },
            ],
          }}
        >
          <TestDetailHooks />
        </SWRConfig>
      );

      expect(leaveConfig).not.toBeNull();
      expect(leaveConfig?.dedupingInterval).toBe(30_000);
      expect(leaveConfig?.revalidateOnMount).toBeUndefined();

      expect(typesConfig).not.toBeNull();
      expect(typesConfig?.dedupingInterval).toBe(30_000);
      expect(typesConfig?.revalidateOnMount).toBeUndefined();
    });

    it("configures useDashboardStats with 180s polling and no forced revalidateOnMount", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestDashboardStatsHook() {
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
          <TestDashboardStatsHook />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(180_000);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
      expect(capturedConfig?.revalidateOnMount).toBeUndefined();
    });

    it("configures useExtensionApprovals with 180s polling and 30s dedupingInterval", () => {
      let capturedConfig: Record<string, unknown> | null = null;
      function TestExtensionApprovalsHook() {
        useExtensionApprovals();
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
          <TestExtensionApprovalsHook />
        </SWRConfig>
      );

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig?.refreshInterval).toBe(180_000);
      expect(capturedConfig?.dedupingInterval).toBe(30_000);
    });
  });

  describe("3. Mutation-driven cache revalidation for workflows", () => {
    it("createLeave triggers revalidation for /api/v1/leaves", async () => {
      let leavesRefetched = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ success: true, data: { id: "new-leave-id" } }),
        }))
      );

      function TestLeaveList() {
        const { data } = useSWR("/api/v1/leaves?test=create", async () => {
          leavesRefetched++;
          return { items: [`item-${leavesRefetched}`] };
        });
        return <div>Data: {data?.items?.[0] ?? "none"}</div>;
      }

      render(
        <SWRConfig value={{ dedupingInterval: 0 }}>
          <TestLeaveList />
        </SWRConfig>
      );

      await screen.findByText("Data: item-1");
      expect(leavesRefetched).toBe(1);

      await createLeave({ reason: "Doctor Appointment" });

      await screen.findByText("Data: item-2");
      expect(leavesRefetched).toBe(2);
    });

    it("cancelLeave triggers revalidation for /api/v1/leaves", async () => {
      let leavesRefetched = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ success: true, data: { status: "CANCELLED" } }),
        }))
      );

      function TestLeaveList() {
        const { data } = useSWR("/api/v1/leaves?test=cancel", async () => {
          leavesRefetched++;
          return { count: leavesRefetched };
        });
        return <div>LeavesCount: {data?.count ?? 0}</div>;
      }

      render(
        <SWRConfig value={{ dedupingInterval: 0 }}>
          <TestLeaveList />
        </SWRConfig>
      );

      await screen.findByText("LeavesCount: 1");

      await cancelLeave("leave-test-id");

      await screen.findByText("LeavesCount: 2");
    });

    it("approveLeave triggers revalidation for /api/v1/approvals and badges", async () => {
      let approvalsRefetched = 0;
      let badgesRefetched = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ success: true, data: { status: "APPROVED" } }),
        }))
      );

      function TestApprovalsAndBadges() {
        const { data: approvals } = useSWR("/api/v1/approvals?test=approve", async () => {
          approvalsRefetched++;
          return { count: approvalsRefetched };
        });
        const { data: badges } = useSWR("/api/v1/badges?test=approve", async () => {
          badgesRefetched++;
          return { count: badgesRefetched };
        });
        return (
          <div>
            <span>Apps: {approvals?.count ?? 0}</span>
            <span>Badges: {badges?.count ?? 0}</span>
          </div>
        );
      }

      render(
        <SWRConfig value={{ dedupingInterval: 0 }}>
          <TestApprovalsAndBadges />
        </SWRConfig>
      );

      await screen.findByText("Apps: 1");
      await screen.findByText("Badges: 1");

      await approveLeave("leave-approval-id");

      await screen.findByText("Apps: 2");
      await screen.findByText("Badges: 2");
    });

    it("rejectLeave triggers revalidation for /api/v1/approvals and badges", async () => {
      let approvalsRefetched = 0;
      let badgesRefetched = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ success: true, data: { status: "REJECTED" } }),
        }))
      );

      function TestApprovalsAndBadges() {
        const { data: approvals } = useSWR("/api/v1/approvals?test=reject", async () => {
          approvalsRefetched++;
          return { count: approvalsRefetched };
        });
        const { data: badges } = useSWR("/api/v1/badges?test=reject", async () => {
          badgesRefetched++;
          return { count: badgesRefetched };
        });
        return (
          <div>
            <span>RejApps: {approvals?.count ?? 0}</span>
            <span>RejBadges: {badges?.count ?? 0}</span>
          </div>
        );
      }

      render(
        <SWRConfig value={{ dedupingInterval: 0 }}>
          <TestApprovalsAndBadges />
        </SWRConfig>
      );

      await screen.findByText("RejApps: 1");
      await screen.findByText("RejBadges: 1");

      await rejectLeave("leave-approval-id");

      await screen.findByText("RejApps: 2");
      await screen.findByText("RejBadges: 2");
    });
  });
});
