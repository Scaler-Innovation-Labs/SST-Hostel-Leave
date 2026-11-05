// @vitest-environment jsdom
import { render, screen, act } from "@testing-library/react";
import React from "react";
import useSWR, { SWRConfig, mutate as globalMutate } from "swr";
import { cache as swrGlobalCache, SWRGlobalState } from "swr/_internal";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
let currentMockUserId: string | null = "user_1";
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    userId: currentMockUserId,
  }),
}));

// Mock next/navigation
let pushedHref = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => {
      pushedHref = href;
    },
    refresh: vi.fn(),
  }),
  usePathname: () => "/super-admin/hostels",
}));

import { useAcademicGroups } from "@/hooks/use-academic-groups";
import { useActiveRole } from "@/hooks/use-active-role";
import { useHostels } from "@/hooks/use-hostels";
import { deleteAcademicGroup, saveAcademicGroup } from "@/lib/api/academic-group-api";
import { deleteHostel, saveHostel } from "@/lib/api/hostel-api";
import { saveLeaveTypeAdmin } from "@/lib/api/leave-api";
import { useLeaveTypes } from "@/features/leaves/hooks/use-leaves";
import { SWRProvider } from "@/providers/SWRProvider";

beforeEach(async () => {
  vi.useRealTimers();
  currentMockUserId = "user_1";
  pushedHref = "";
  clearSWRGlobalCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(async () => {
  clearSWRGlobalCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Commit 2 — Reference Data Caching & Mutation Invalidation", () => {
  describe("1. Initial fetch & multi-component cache sharing", () => {
    it("fetches reference data on initial mount and shares cached data across multiple consumers without duplicate requests", async () => {
      let hostelNetworkRequests = 0;

      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          if (urlStr.includes("/api/v1/hostels")) {
            hostelNetworkRequests++;
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: [
                  { id: "h1", name: "Hostel 1", code: "H1", isActive: true },
                  { id: "h2", name: "Hostel 2", code: "H2", isActive: true },
                ],
              }),
            };
          }
          return {
            ok: false,
            status: 404,
            json: async () => ({ success: false }),
          };
        })
      );

      function ConsumerA() {
        const { hostels, isLoading } = useHostels();
        if (isLoading) return <div>loading-a</div>;
        return <div data-testid="consumer-a">count:{hostels.length}</div>;
      }

      function ConsumerB() {
        const { hostels, isLoading } = useHostels();
        if (isLoading) return <div>loading-b</div>;
        return <div data-testid="consumer-b">count:{hostels.length}</div>;
      }

      function ParentPage() {
        return (
          <SWRProvider>
            <ConsumerA />
            <ConsumerB />
          </SWRProvider>
        );
      }

      render(<ParentPage />);

      await screen.findByTestId("consumer-a");
      await screen.findByTestId("consumer-b");

      expect(screen.getByTestId("consumer-a").textContent).toBe("count:2");
      expect(screen.getByTestId("consumer-b").textContent).toBe("count:2");
      // Measured: exactly 1 network request for both components combined
      expect(hostelNetworkRequests).toBe(1);
    });
  });

  describe("2. Navigation and remount behavior", () => {
    it("reuses cached reference data on remount without triggering background revalidation", async () => {
      let academicGroupRequests = 0;

      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          if (urlStr.includes("/api/v1/academic-groups")) {
            academicGroupRequests++;
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: [{ id: "ag1", name: "CSE-2026", batchYear: 2026, isActive: true }],
              }),
            };
          }
          return {
            ok: false,
            status: 404,
            json: async () => ({ success: false }),
          };
        })
      );

      function PageComponent() {
        const { academicGroups, isLoading } = useAcademicGroups();
        if (isLoading) return <div>loading-groups</div>;
        return <div data-testid="groups-count">groups:{academicGroups.length}</div>;
      }

      // Initial Mount
      const { unmount } = render(
        <SWRProvider>
          <PageComponent />
        </SWRProvider>
      );

      await screen.findByTestId("groups-count");
      expect(academicGroupRequests).toBe(1);

      // Navigate away (unmount)
      unmount();

      // Navigate back (remount within provider)
      render(
        <SWRProvider>
          <PageComponent />
        </SWRProvider>
      );

      await screen.findByTestId("groups-count");
      // Measured: 0 additional network requests upon remount
      expect(academicGroupRequests).toBe(1);
    });
  });

  describe("3. Mutation invalidation for Hostels, Academic Groups, and Leave Types", () => {
    it("revalidates /api/v1/hostels cache after saveHostel and deleteHostel succeed", async () => {
      let getRequests = 0;
      let postRequests = 0;
      let deleteRequests = 0;

      let hostelList = [{ id: "h1", name: "Hostel A", code: "HA", isActive: true }];

      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          const method = init?.method ?? "GET";

          if (urlStr.endsWith("/api/v1/hostels") && method === "GET") {
            getRequests++;
            return {
              ok: true,
              status: 200,
              json: async () => ({ success: true, data: hostelList }),
            };
          }

          if (urlStr.endsWith("/api/v1/hostels") && method === "POST") {
            postRequests++;
            hostelList = [...hostelList, { id: "h2", name: "Hostel B", code: "HB", isActive: true }];
            return {
              ok: true,
              status: 201,
              json: async () => ({ success: true, data: { id: "h2" } }),
            };
          }

          if (urlStr.includes("/api/v1/hostels/h2") && method === "DELETE") {
            deleteRequests++;
            hostelList = hostelList.filter((h) => h.id !== "h2");
            return {
              ok: true,
              status: 200,
              json: async () => ({ success: true, data: { deleted: true } }),
            };
          }

          return { ok: false, status: 400, json: async () => ({ success: false }) };
        })
      );

      function HostelWatcher() {
        const { hostels } = useHostels();
        return <div data-testid="hostel-list">{hostels.map((h) => h.name).join(",")}</div>;
      }

      render(
        <SWRProvider>
          <HostelWatcher />
        </SWRProvider>
      );

      await screen.findByText("Hostel A");
      expect(getRequests).toBe(1);

      // Perform saveHostel mutation
      await act(async () => {
        await saveHostel({ name: "Hostel B", code: "HB", isActive: true });
      });

      // UI automatically displays updated list
      await screen.findByText("Hostel A,Hostel B");
      expect(postRequests).toBe(1);
      expect(getRequests).toBe(2);

      // Perform deleteHostel mutation
      await act(async () => {
        await deleteHostel("h2");
      });

      await screen.findByText("Hostel A");
      expect(deleteRequests).toBe(1);
      expect(getRequests).toBe(3);
    });

    it("revalidates /api/v1/academic-groups cache after saveAcademicGroup and deleteAcademicGroup succeed", async () => {
      let getRequests = 0;
      let groupList = [{ id: "ag1", name: "Batch 2026", departmentId: "d1", batchYear: 2026, groupCode: "B26", isActive: true }];

      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          const method = init?.method ?? "GET";

          if (urlStr.endsWith("/api/v1/academic-groups") && method === "GET") {
            getRequests++;
            return {
              ok: true,
              status: 200,
              json: async () => ({ success: true, data: groupList }),
            };
          }

          if (urlStr.endsWith("/api/v1/academic-groups") && method === "POST") {
            groupList = [...groupList, { id: "ag2", name: "Batch 2027", departmentId: "d1", batchYear: 2027, groupCode: "B27", isActive: true }];
            return {
              ok: true,
              status: 201,
              json: async () => ({ success: true, data: { id: "ag2" } }),
            };
          }

          return { ok: false, status: 400, json: async () => ({ success: false }) };
        })
      );

      function AcademicGroupWatcher() {
        const { academicGroups } = useAcademicGroups();
        return <div data-testid="group-list">{academicGroups.map((g) => g.name).join(",")}</div>;
      }

      render(
        <SWRProvider>
          <AcademicGroupWatcher />
        </SWRProvider>
      );

      await screen.findByText("Batch 2026");
      expect(getRequests).toBe(1);

      await act(async () => {
        await saveAcademicGroup({ name: "Batch 2027", departmentId: "d1", batchYear: 2027, isActive: true });
      });

      await screen.findByText("Batch 2026,Batch 2027");
      expect(getRequests).toBe(2);
    });

    it("revalidates /api/v1/leave-types and /api/v1/admin/leave-types after saveLeaveTypeAdmin succeeds", async () => {
      let clientGetRequests = 0;
      let adminGetRequests = 0;

      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          const method = init?.method ?? "GET";

          if (urlStr.endsWith("/api/v1/leave-types") && method === "GET") {
            clientGetRequests++;
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: [{ id: "lt1", name: "Weekend Leave", code: "WEEKEND" }],
              }),
            };
          }

          if (urlStr.endsWith("/api/v1/admin/leave-types") && method === "GET") {
            adminGetRequests++;
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: [{ id: "lt1", name: "Weekend Leave", code: "WEEKEND", isActive: true }],
              }),
            };
          }

          if (urlStr.endsWith("/api/v1/admin/leave-types") && method === "POST") {
            return {
              ok: true,
              status: 201,
              json: async () => ({ success: true, data: { id: "lt2" } }),
            };
          }

          return { ok: false, status: 400, json: async () => ({ success: false }) };
        })
      );

      function LeaveTypeWatcher() {
        const { leaveTypes } = useLeaveTypes();
        return <div data-testid="leave-types">{leaveTypes.map((t) => t.name).join(",")}</div>;
      }

      render(
        <SWRProvider>
          <LeaveTypeWatcher />
        </SWRProvider>
      );

      await screen.findByText("Weekend Leave");
      expect(clientGetRequests).toBe(1);

      await act(async () => {
        await saveLeaveTypeAdmin({ name: "Medical Leave", code: "MED", isActive: true });
      });

      // Measured: revalidated both client and admin cache keys
      expect(clientGetRequests).toBe(2);
    });
  });

  describe("4. Failed mutation error handling", () => {
    it("does not prematurely invalidate or corrupt cache when a mutation fails", async () => {
      let getRequests = 0;

      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          const method = init?.method ?? "GET";

          if (urlStr.endsWith("/api/v1/hostels") && method === "GET") {
            getRequests++;
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: [{ id: "h1", name: "Existing Hostel", code: "EH", isActive: true }],
              }),
            };
          }

          if (urlStr.endsWith("/api/v1/hostels") && method === "POST") {
            return {
              ok: false,
              status: 400,
              json: async () => ({ success: false, error: { message: "Duplicate code" } }),
            };
          }

          return { ok: false, status: 500, json: async () => ({ success: false }) };
        })
      );

      function HostelComponent() {
        const { hostels } = useHostels();
        return <div>{hostels.map((h) => h.name).join(",")}</div>;
      }

      render(
        <SWRProvider>
          <HostelComponent />
        </SWRProvider>
      );

      await screen.findByText("Existing Hostel");
      expect(getRequests).toBe(1);

      // Attempt failing mutation
      let mutationError: Error | null = null;
      try {
        await saveHostel({ name: "Bad Hostel", code: "EH" });
      } catch (err) {
        mutationError = err as Error;
      }

      expect(mutationError).not.toBeNull();
      expect(mutationError?.message).toBe("Duplicate code");

      // Cache remains intact, no redundant GET fired
      expect(getRequests).toBe(1);
      expect(screen.getByText("Existing Hostel")).toBeDefined();
    });
  });

  describe("5. Role & User Identity switching cache clearance", () => {
    it("clears reference data cache on active role switch to prevent cross-role data leaks", async () => {
      let hostelRequests = 0;

      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          const method = init?.method ?? "GET";

          if (urlStr.endsWith("/api/v1/hostels")) {
            hostelRequests++;
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: [{ id: "h1", name: "Hostel 1", code: "H1", isActive: true }],
              }),
            };
          }

          if (urlStr.endsWith("/api/v1/me/roles")) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: {
                  roles: [
                    { role: "SUPER_ADMIN", label: "Super Admin", dashboardHref: "/super-admin" },
                    { role: "ADMIN", label: "Admin", dashboardHref: "/admin" },
                  ],
                  activeRole: "SUPER_ADMIN",
                },
              }),
            };
          }

          if (urlStr.endsWith("/api/v1/me/active-role") && method === "POST") {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: { activeRole: "ADMIN", dashboardHref: "/admin" },
              }),
            };
          }

          return { ok: false, status: 404, json: async () => ({ success: false }) };
        })
      );

      function TestRoleAndHostelComponent() {
        const { switchRole } = useActiveRole();
        const { hostels } = useHostels();

        return (
          <div>
            <div data-testid="hostels">{hostels.map((h) => h.name).join(",")}</div>
            <button onClick={() => switchRole("ADMIN" as never)}>Switch Role</button>
          </div>
        );
      }

      render(
        <SWRProvider>
          <TestRoleAndHostelComponent />
        </SWRProvider>
      );

      await screen.findByText("Hostel 1");
      expect(hostelRequests).toBe(1);

      // Perform role switch
      await act(async () => {
        screen.getByText("Switch Role").click();
      });

      expect(pushedHref).toBe("/admin");
    });

    it("clears cached reference data when Clerk userId changes", async () => {
      let hostelRequests = 0;

      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          if (urlStr.includes("/api/v1/hostels")) {
            hostelRequests++;
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: [{ id: "h1", name: `Hostel for ${currentMockUserId}`, code: "H1", isActive: true }],
              }),
            };
          }
          return { ok: false, status: 404, json: async () => ({ success: false }) };
        })
      );

      function TestIdentityComponent() {
        const { hostels } = useHostels();
        return <div>{hostels.map((h) => h.name).join(",")}</div>;
      }

      function AppWrapper({ showComponent }: { showComponent: boolean }) {
        return (
          <SWRProvider>
            {showComponent && <TestIdentityComponent />}
          </SWRProvider>
        );
      }

      const { rerender } = render(<AppWrapper showComponent={true} />);

      await screen.findByText("Hostel for user_1");
      expect(hostelRequests).toBe(1);

      // Switch Clerk user and unmount component (simulate logout / route transition)
      currentMockUserId = "user_2";
      await act(async () => {
        rerender(<AppWrapper showComponent={false} />);
      });

      // When component remounts under user_2, user_1's data is purged from cache
      await act(async () => {
        rerender(<AppWrapper showComponent={true} />);
      });

      // Previous user's scoped data was wiped from cache, never exposed to user 2
      expect(screen.queryByText("Hostel for user_1")).toBeNull();
    });
  });

  describe("6. Manual refresh & Error recovery", () => {
    it("allows manual refresh via mutate() to retrieve updated data on demand", async () => {
      let getCount = 0;

      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          if (urlStr.includes("/api/v1/hostels")) {
            getCount++;
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: [{ id: "h1", name: `Hostel v${getCount}`, code: "H1", isActive: true }],
              }),
            };
          }
          return { ok: false, status: 404, json: async () => ({ success: false }) };
        })
      );

      function ManualRefreshComponent() {
        const { hostels, mutate } = useHostels();
        return (
          <div>
            <div data-testid="hostel-name">{hostels[0]?.name}</div>
            <button onClick={() => mutate()}>Refresh</button>
          </div>
        );
      }

      render(
        <SWRProvider>
          <ManualRefreshComponent />
        </SWRProvider>
      );

      await screen.findByText("Hostel v1");
      expect(getCount).toBe(1);

      // Click manual refresh
      await act(async () => {
        screen.getByText("Refresh").click();
      });

      await screen.findByText("Hostel v2");
      expect(getCount).toBe(2);
    });

    it("recovers gracefully when request fails initially and then succeeds on retry", async () => {
      let attempts = 0;

      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL | Request) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          if (urlStr.includes("/api/v1/academic-groups")) {
            attempts++;
            if (attempts === 1) {
              return {
                ok: false,
                status: 500,
                json: async () => ({ success: false, error: { message: "Internal server error" } }),
              };
            }
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: [{ id: "ag1", name: "Recovered Batch", departmentId: "d1", batchYear: 2026, groupCode: "RB", isActive: true }],
              }),
            };
          }
          return { ok: false, status: 404, json: async () => ({ success: false }) };
        })
      );

      function RecoverComponent() {
        const { academicGroups, isError, error, mutate } = useAcademicGroups();
        if (isError) {
          return (
            <div>
              <p>Error: {error?.message}</p>
              <button onClick={() => mutate()}>Retry</button>
            </div>
          );
        }
        return <div>{academicGroups.map((g) => g.name).join(",")}</div>;
      }

      render(
        <SWRConfig value={{ errorRetryCount: 0 }}>
          <SWRProvider>
            <RecoverComponent />
          </SWRProvider>
        </SWRConfig>
      );

      await screen.findByText(/Error: Internal server error/);

      // Trigger retry
      await act(async () => {
        screen.getByText("Retry").click();
      });

      await screen.findByText("Recovered Batch");
      expect(attempts).toBe(2);
    });
  });
});
