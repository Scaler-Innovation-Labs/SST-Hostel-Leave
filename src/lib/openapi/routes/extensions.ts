import { z } from "zod";

import { apiErrorSchema, createSuccessResponseSchema, registry } from "../registry";

const leaveExtensionSchema = registry.register(
  "LeaveExtension",
  z.object({
    id: z.string().uuid(),
    leaveRequestId: z.string().uuid(),
    requestedEndAt: z.string().datetime(),
    reason: z.string(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
    appliedAt: z.string().datetime(),
    decidedAt: z.string().datetime().nullable(),
    comments: z.string().nullable(),
  })
);

export function registerExtensionRoutes() {
  // GET /api/v1/leaves/{id}/extensions
  registry.registerPath({
    method: "get",
    path: "/api/v1/leaves/{id}/extensions",
    summary: "List extension requests for a leave",
    description:
      "Retrieves the history of extension requests submitted for a specific leave request.",
    security: [{ BearerAuth: [] }],
    tags: ["Leave Extensions"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Leave Request ID" }),
      }),
      query: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
      }),
    },
    responses: {
      200: {
        description: "List of extension requests",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "LeaveExtensionsListResponse",
              z.object({
                items: z.array(leaveExtensionSchema),
                pagination: z.object({
                  page: z.number(),
                  limit: z.number(),
                  total: z.number(),
                  totalPages: z.number(),
                }),
              })
            ),
          },
        },
      },
      404: {
        description: "Leave request not found",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // POST /api/v1/leaves/{id}/extensions
  registry.registerPath({
    method: "post",
    path: "/api/v1/leaves/{id}/extensions",
    summary: "Request extension on an active leave",
    description:
      "Students can request an extension on an active or approved leave before return. Creates a leave_extensions record without altering the parent leave request until approved.",
    security: [{ BearerAuth: [] }],
    tags: ["Leave Extensions"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Leave Request ID" }),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              requestedEndAt: z.string().datetime().openapi({
                description: "New desired return date/time in ISO format",
                example: "2026-11-05T18:00:00.000Z",
              }),
              reason: z.string().min(5).max(500).openapi({
                description: "Reason for extending the leave",
                example: "Train rescheduled by 2 days due to weather.",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Extension request submitted",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("CreateExtensionResponse", leaveExtensionSchema),
          },
        },
      },
      400: {
        description: "Invalid extension date or pending extension already exists",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/v1/extensions/approvals
  registry.registerPath({
    method: "get",
    path: "/api/v1/extensions/approvals",
    summary: "Staff extension approvals queue",
    description:
      "Lists pending leave extension requests waiting for warden or POC review.",
    security: [{ BearerAuth: [] }],
    tags: ["Leave Extensions"],
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
      }),
    },
    responses: {
      200: {
        description: "Paginated extension approvals queue",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ExtensionApprovalsQueueResponse",
              z.object({
                items: z.array(
                  z.object({
                    id: z.string().uuid(),
                    leaveRequestId: z.string().uuid(),
                    studentName: z.string(),
                    rollNumber: z.string(),
                    roomNumber: z.string().nullable(),
                    hostelName: z.string().nullable(),
                    currentEndAt: z.string().datetime(),
                    requestedEndAt: z.string().datetime(),
                    reason: z.string(),
                    status: z.string(),
                    appliedAt: z.string().datetime(),
                  })
                ),
                pagination: z.object({
                  page: z.number(),
                  limit: z.number(),
                  total: z.number(),
                  totalPages: z.number(),
                }),
              })
            ),
          },
        },
      },
    },
  });

  // GET /api/v1/extensions/{id}
  registry.registerPath({
    method: "get",
    path: "/api/v1/extensions/{id}",
    summary: "Get extension request details",
    description:
      "Retrieves full details for a single extension request.",
    security: [{ BearerAuth: [] }],
    tags: ["Leave Extensions"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Extension ID" }),
      }),
    },
    responses: {
      200: {
        description: "Extension details retrieved",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("ExtensionDetailResponse", leaveExtensionSchema),
          },
        },
      },
      404: {
        description: "Extension not found",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // POST /api/v1/extensions/{id}/approve
  registry.registerPath({
    method: "post",
    path: "/api/v1/extensions/{id}/approve",
    summary: "Decision on extension request",
    description:
      "Approves or rejects a pending extension request. If approved, the parent leave request endAt is automatically updated.",
    security: [{ BearerAuth: [] }],
    tags: ["Leave Extensions"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Extension ID" }),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              decision: z.enum(["APPROVED", "REJECTED"]).openapi({
                example: "APPROVED",
              }),
              comments: z.string().optional().openapi({
                example: "Extension approved after contacting parents.",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Extension decision recorded",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ExtensionDecisionSuccessResponse",
              z.object({
                id: z.string().uuid(),
                status: z.enum(["APPROVED", "REJECTED"]),
              })
            ),
          },
        },
      },
      400: {
        description: "Extension is not in PENDING state",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });
}
