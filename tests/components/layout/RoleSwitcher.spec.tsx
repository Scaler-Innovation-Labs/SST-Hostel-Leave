// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoleSwitcher } from "@/components/layout/RoleSwitcher";

const push = vi.fn();
const refresh = vi.fn();
let mockPathname = "/student/dashboard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => mockPathname,
}));

const MULTI_ROLE_PAYLOAD = {
  success: true,
  data: {
    roles: [
      { role: "STUDENT", label: "Student", dashboardHref: "/student/dashboard" },
      { role: "POC", label: "POC", dashboardHref: "/poc/dashboard" },
    ],
    activeRole: "STUDENT",
  },
};

const DUPLICATE_ROLE_PAYLOAD = {
  success: true,
  data: {
    roles: [
      { role: "ADMIN", label: "Admin", dashboardHref: "/admin/dashboard" },
      { role: "ADMIN", label: "Admin", dashboardHref: "/admin/dashboard" },
      { role: "ADMIN", label: "Admin", dashboardHref: "/admin/dashboard" },
      { role: "GUARD", label: "Guard", dashboardHref: "/guard/scanner" },
    ],
    activeRole: "ADMIN",
  },
};

const SINGLE_ROLE_PAYLOAD = {
  success: true,
  data: {
    roles: [
      { role: "STUDENT", label: "Student", dashboardHref: "/student/dashboard" },
    ],
    activeRole: "STUDENT",
  },
};

function mockGetRoles(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      if (typeof url === "string" && url.includes("/active-role")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { activeRole: "POC", dashboardHref: "/poc/dashboard" },
          }),
        };
      }
      return { ok: true, json: async () => payload };
    })
  );
}

function renderSwitcher(
  props: { fallbackLabel?: string; currentRole?: any; compact?: boolean } = {}
) {
  const { fallbackLabel = "Student", currentRole, compact = false } = props;
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <RoleSwitcher
        fallbackLabel={fallbackLabel}
        currentRole={currentRole}
        compact={compact}
      />
    </SWRConfig>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// tests/setup.ts enables fake timers globally, which stalls SWR's async
// flow and testing-library's findBy/waitFor polling. This spec needs the
// real event loop.
beforeEach(() => {
  vi.useRealTimers();
  mockPathname = "/student/dashboard";
});

describe("RoleSwitcher", () => {
  it("shows the fallback label while roles are loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {}))
    );
    renderSwitcher();

    expect(screen.getByText("Student")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the fallback label for a single-role user", async () => {
    mockGetRoles(SINGLE_ROLE_PAYLOAD);
    renderSwitcher();

    await screen.findByText("Student");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders a switcher button when the user has several roles", async () => {
    mockGetRoles(MULTI_ROLE_PAYLOAD);
    renderSwitcher();

    const trigger = await screen.findByRole("button", {
      name: /switch console, current: student/i,
    });
    expect(trigger).toBeInTheDocument();
  });

  it("switches console and navigates when another role is chosen", async () => {
    mockGetRoles(MULTI_ROLE_PAYLOAD);
    renderSwitcher();

    const trigger = await screen.findByRole("button", {
      name: /switch console/i,
    });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    const item = await screen.findByRole("menuitem", { name: "POC" });
    fireEvent.click(item);

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/me/active-role",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ role: "POC" }),
      })
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/poc/dashboard")
    );
  });

  it("renders a compact header-sized trigger for shell headers", async () => {
    mockGetRoles(MULTI_ROLE_PAYLOAD);
    renderSwitcher({ fallbackLabel: "Guard", compact: true });

    const trigger = await screen.findByRole("button", {
      name: /switch console, current: student/i,
    });
    expect(trigger.className).toContain("shrink-0");
    expect(trigger.className).not.toContain("flex-1");
  });

  it("deduplicates repeated role entries in the switch console menu", async () => {
    mockGetRoles(DUPLICATE_ROLE_PAYLOAD);
    renderSwitcher({ fallbackLabel: "Admin" });

    const trigger = await screen.findByRole("button", {
      name: /switch console/i,
    });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    const adminItems = await screen.findAllByRole("menuitem", { name: "Admin" });
    expect(adminItems).toHaveLength(1);

    const guardItems = await screen.findAllByRole("menuitem", { name: "Guard" });
    expect(guardItems).toHaveLength(1);
  });

  it("displays Guard when on /guard/scanner even if activeRole was Admin", async () => {
    mockPathname = "/guard/scanner";
    mockGetRoles(DUPLICATE_ROLE_PAYLOAD);
    renderSwitcher({ fallbackLabel: "Guard", compact: true });

    const trigger = await screen.findByRole("button", {
      name: /switch console, current: guard/i,
    });
    expect(trigger).toBeInTheDocument();
  });
});
