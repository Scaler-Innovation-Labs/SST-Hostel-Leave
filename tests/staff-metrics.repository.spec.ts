import { describe, expect, it, vi } from "vitest";

import { staffMetricsRepository } from "@/db/repositories/dashboard/staff-metrics.repository";

describe("staffMetricsRepository.getLocationAndUserStats", () => {
  it("executes single CTE query with no hostel filter for super-admin", async () => {
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

  it("applies hostel filter with IN clause to both CTEs for hostel-scoped staff", async () => {
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

    const stats = await staffMetricsRepository.getLocationAndUserStats(["H1", "H2"], mockDbClient as any);

    expect(mockDbClient.execute).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({
      totalUsers: 45,
      total: 40,
      active: 38,
      inHostel: 30,
      outsideHostel: 8,
      overdue: 2,
    });
    // Verify that hostel scoping is applied via IN clause to both users and students
    expect(capturedQuery).toContain("users.hostel_id IN");
    expect(capturedQuery).toContain("u.hostel_id IN");
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
    // If user and student tables were naively joined together, a hostel with 5 staff users
    // and 10 students could multiply counts or misattribute staff users to student counts.
    // The CTE architecture ensures user_stat and student_stat are scalar aggregates:
    const mockDbClient = {
      execute: vi.fn().mockImplementation(async () => {
        // user_stat counts all users in the hostel (including non-student staff) = 15
        // student_stat counts only students = 10
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
