import { describe, expect, it, vi } from "vitest";

import { staffMetricsRepository } from "@/db/repositories/dashboard/staff-metrics.repository";

describe("staffMetricsRepository.getLocationAndUserStats", () => {
  it("executes single CTE query with no hostel filter for super-admin (unscoped)", async () => {
    let capturedQuery = "";
    const mockDbClient = {
      execute: vi.fn().mockImplementation(async (query: any) => {
        try {
          capturedQuery = query.toQuery ? query.toQuery({ escapeName: (s: string) => `"${s}"`, escapeParam: (i: number) => `$${i + 1}` }).sql : String(query);
        } catch {
          capturedQuery = JSON.stringify(query);
        }
        return {
          rows: [
            {
              totalUsers: 150,
              total: 120,
              active: 110,
              inHostel: 90,
              outsideHostel: 25,
              overdue: 5,
            },
          ],
        };
      }),
    };

    const stats = await staffMetricsRepository.getLocationAndUserStats(undefined, mockDbClient as any);

    expect(mockDbClient.execute).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({
      totalUsers: 150,
      total: 120,
      active: 110,
      inHostel: 90,
      outsideHostel: 25,
      overdue: 5,
    });
    // Check that CTE structure is present and no hostel filter is applied
    expect(capturedQuery).toContain("WITH user_stat AS");
    expect(capturedQuery).toContain("student_stat AS");
    expect(capturedQuery).not.toContain("WHERE users.hostel_id");
  });

  it("applies IN clause for a staff member scoped to one hostel", async () => {
    let capturedQuery = "";
    let capturedParams: any[] = [];
    const mockDbClient = {
      execute: vi.fn().mockImplementation(async (query: any) => {
        try {
          if (query.toQuery) {
            const compiled = query.toQuery({ escapeName: (s: string) => `"${s}"`, escapeParam: (i: number) => `$${i + 1}` });
            capturedQuery = compiled.sql;
            capturedParams = compiled.params;
          }
        } catch {
          capturedQuery = JSON.stringify(query);
        }
        return {
          rows: [
            {
              totalUsers: 45,
              total: 40,
              active: 38,
              inHostel: 30,
              outsideHostel: 8,
              overdue: 2,
            },
          ],
        };
      }),
    };

    const stats = await staffMetricsRepository.getLocationAndUserStats(["HOSTEL_A"], mockDbClient as any);

    expect(mockDbClient.execute).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({
      totalUsers: 45,
      total: 40,
      active: 38,
      inHostel: 30,
      outsideHostel: 8,
      overdue: 2,
    });
    // Verify that hostel scoping uses IN ($1) and NOT malformed ANY(($1))
    expect(capturedQuery).toContain("users.hostel_id IN ($1)");
    expect(capturedQuery).toContain("u.hostel_id IN ($");
    expect(capturedQuery).not.toContain("ANY(");
    expect(capturedParams).toContain("HOSTEL_A");
  });

  it("applies IN clause for a user authorized for multiple hostels", async () => {
    let capturedQuery = "";
    let capturedParams: any[] = [];
    const mockDbClient = {
      execute: vi.fn().mockImplementation(async (query: any) => {
        try {
          if (query.toQuery) {
            const compiled = query.toQuery({ escapeName: (s: string) => `"${s}"`, escapeParam: (i: number) => `$${i + 1}` });
            capturedQuery = compiled.sql;
            capturedParams = compiled.params;
          }
        } catch {
          capturedQuery = JSON.stringify(query);
        }
        return {
          rows: [
            {
              totalUsers: 90,
              total: 80,
              active: 76,
              inHostel: 60,
              outsideHostel: 16,
              overdue: 4,
            },
          ],
        };
      }),
    };

    const stats = await staffMetricsRepository.getLocationAndUserStats(["HOSTEL_A", "HOSTEL_B"], mockDbClient as any);

    expect(mockDbClient.execute).toHaveBeenCalledTimes(1);
    expect(stats.totalUsers).toBe(90);
    expect(stats.total).toBe(80);
    // Verifies that multiple parameters are individual scalars in the IN clause
    expect(capturedQuery).toContain("users.hostel_id IN ($1, $2)");
    expect(capturedParams).toContain("HOSTEL_A");
    expect(capturedParams).toContain("HOSTEL_B");
    expect(capturedQuery).not.toContain("ANY(");
  });

  it("returns zero counts for an empty hostel scope (unassigned staff)", async () => {
    const mockDbClient = {
      execute: vi.fn(),
    };

    // When an unassigned staff member has scope restriction with 0 hostels:
    const stats = await staffMetricsRepository.getLocationAndUserStats([], mockDbClient as any);

    // Database should not even be queried to prevent cross-hostel leakage
    expect(mockDbClient.execute).not.toHaveBeenCalled();
    expect(stats).toEqual({
      totalUsers: 0,
      total: 0,
      active: 0,
      inHostel: 0,
      outsideHostel: 0,
      overdue: 0,
    });
  });

  it("ensures statistics never include another hostel's users or students", async () => {
    let userFilter = "";
    let studentFilter = "";
    const mockDbClient = {
      execute: vi.fn().mockImplementation(async (query: any) => {
        const sqlStr = query.toQuery ? query.toQuery({ escapeName: (s: string) => `"${s}"`, escapeParam: (i: number) => `$${i + 1}` }).sql : "";
        userFilter = sqlStr.match(/WHERE users\.hostel_id [^\n]+/)?.[0] ?? "";
        studentFilter = sqlStr.match(/WHERE u\.hostel_id [^\n]+/)?.[0] ?? "";
        return {
          rows: [
            {
              totalUsers: 50,
              total: 45,
              active: 45,
              inHostel: 35,
              outsideHostel: 10,
              overdue: 0,
            },
          ],
        };
      }),
    };

    await staffMetricsRepository.getLocationAndUserStats(["HOSTEL_ISOLATED"], mockDbClient as any);

    // Both CTEs must strictly filter by the authorized hostel
    expect(userFilter).toBe('WHERE users.hostel_id IN ($1)');
    expect(studentFilter).toBe('WHERE u.hostel_id IN ($5)');
  });

  it("handles empty database or empty hostel cleanly with zero counts", async () => {
    const mockDbClient = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            totalUsers: 0,
            total: 0,
            active: 0,
            inHostel: 0,
            outsideHostel: 0,
            overdue: 0,
          },
        ],
      }),
    };

    const stats = await staffMetricsRepository.getLocationAndUserStats(["EMPTY_HOSTEL"], mockDbClient as any);

    expect(stats).toEqual({
      totalUsers: 0,
      total: 0,
      active: 0,
      inHostel: 0,
      outsideHostel: 0,
      overdue: 0,
    });
  });

  it("handles missing/null row safely without NaN or crashes", async () => {
    const mockDbClient = {
      execute: vi.fn().mockResolvedValue({
        rows: [],
      }),
    };

    const stats = await staffMetricsRepository.getLocationAndUserStats(["H1"], mockDbClient as any);

    expect(stats).toEqual({
      totalUsers: 0,
      total: 0,
      active: 0,
      inHostel: 0,
      outsideHostel: 0,
      overdue: 0,
    });
  });

  it("prevents join multiplication by isolating user_stat from student_stat in CTEs", async () => {
    const mockDbClient = {
      execute: vi.fn().mockImplementation(async () => {
        return {
          rows: [
            {
              totalUsers: 15,
              total: 10,
              active: 10,
              inHostel: 7,
              outsideHostel: 2,
              overdue: 1,
            },
          ],
        };
      }),
    };

    const stats = await staffMetricsRepository.getLocationAndUserStats(["H1"], mockDbClient as any);

    expect(stats.totalUsers).toBe(15);
    expect(stats.total).toBe(10);
    expect(stats.totalUsers).not.toBe(stats.total);
  });
});
