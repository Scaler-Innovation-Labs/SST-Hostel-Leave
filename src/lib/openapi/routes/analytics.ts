import { z } from "zod";

import { apiErrorSchema, createSuccessResponseSchema, registry } from "../registry";

export function registerAnalyticsRoutes() {
  // GET /api/v1/dashboard/stats
  registry.registerPath({
    method: "get",
    path: "/api/v1/dashboard/stats",
    summary: "Get dashboard KPI statistics",
    description:
      "Retrieves real-time dashboard counters and metrics. For students, returns personal leave quotas and active statuses. For staff, aggregates pending approvals, students on leave, and overdue return counts.",
    security: [{ BearerAuth: [] }],
    tags: ["Dashboard & Analytics"],
    request: {
      query: z.object({
        status: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "Dashboard statistics retrieved",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "DashboardStatsResponse",
              z.record(z.string(), z.unknown())
            ),
          },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/v1/badges
  registry.registerPath({
    method: "get",
    path: "/api/v1/badges",
    summary: "Get aggregate notification badges",
    description:
      "Returns unread notification counters, pending approvals count, and overdue return alerts in a single round-trip for navigation headers.",
    security: [{ BearerAuth: [] }],
    tags: ["Dashboard & Analytics"],
    responses: {
      200: {
        description: "Badge counters retrieved",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "NavBadgesResponse",
              z.object({
                pendingApprovals: z.number().openapi({ example: 4 }),
                pendingExtensions: z.number().openapi({ example: 1 }),
                overdueCount: z.number().openapi({ example: 0 }),
              })
            ),
          },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/v1/analytics/leaves
  registry.registerPath({
    method: "get",
    path: "/api/v1/analytics/leaves",
    summary: "Leave trend analytics",
    description:
      "Calculates time-series trends and volume distributions of leave requests over 7d, 30d, 90d, or all-time periods.",
    security: [{ BearerAuth: [] }],
    tags: ["Dashboard & Analytics"],
    request: {
      query: z.object({
        period: z.enum(["7d", "30d", "90d", "all"]).optional().openapi({ example: "30d" }),
      }),
    },
    responses: {
      200: {
        description: "Leave analytics data points",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "LeaveAnalyticsResponse",
              z.object({
                totalLeaves: z.number(),
                approvedLeaves: z.number(),
                rejectedLeaves: z.number(),
                byType: z.array(
                  z.object({
                    leaveTypeId: z.string().uuid(),
                    name: z.string(),
                    count: z.number(),
                  })
                ),
                timeline: z.array(
                  z.object({
                    date: z.string(),
                    count: z.number(),
                  })
                ),
              })
            ),
          },
        },
      },
      403: {
        description: "Staff access only",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/v1/analytics/movements
  registry.registerPath({
    method: "get",
    path: "/api/v1/analytics/movements",
    summary: "Gate movement traffic analytics",
    description:
      "Provides analysis of exit and entry movements, highlighting peak gate hours and turnstile bottlenecks.",
    security: [{ BearerAuth: [] }],
    tags: ["Dashboard & Analytics"],
    request: {
      query: z.object({
        period: z.enum(["7d", "30d", "90d", "all"]).optional(),
      }),
    },
    responses: {
      200: {
        description: "Movement analytics retrieved",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "MovementAnalyticsResponse",
              z.object({
                totalExits: z.number(),
                totalReturns: z.number(),
                peakHour: z.number().openapi({ example: 17 }),
                hourlyDistribution: z.array(
                  z.object({
                    hour: z.number(),
                    exits: z.number(),
                    returns: z.number(),
                  })
                ),
              })
            ),
          },
        },
      },
    },
  });

  // GET /api/v1/analytics/rejections
  registry.registerPath({
    method: "get",
    path: "/api/v1/analytics/rejections",
    summary: "Leave rejection breakdown",
    description:
      "Categorizes rejection reasons (e.g., policy violations, incomplete forms, attendance shortages) to assist in policy tuning.",
    security: [{ BearerAuth: [] }],
    tags: ["Dashboard & Analytics"],
    responses: {
      200: {
        description: "Rejection analysis breakdown",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "RejectionsAnalyticsResponse",
              z.object({
                totalRejections: z.number(),
                categories: z.array(
                  z.object({
                    category: z.string(),
                    count: z.number(),
                    percentage: z.number(),
                  })
                ),
              })
            ),
          },
        },
      },
    },
  });
}
