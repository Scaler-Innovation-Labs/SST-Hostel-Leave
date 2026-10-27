import { z } from "zod";

import { apiErrorSchema, createSuccessResponseSchema, registry } from "../registry";

const leaveResponseSchema = registry.register(
  "LeaveRequest",
  z.object({
    id: z.string().uuid(),
    requestNumber: z.string().openapi({ example: "LR-1042" }),
    studentId: z.string().uuid(),
    leaveTypeId: z.string().uuid(),
    status: z.string().openapi({ example: "PENDING" }),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string(),
    submittedAt: z.string().datetime(),
  })
);

const createLeaveBodySchema = registry.register(
  "CreateLeaveRequest",
  z.object({
    leaveTypeId: z.string().uuid().openapi({
      description: "UUID of the leave type being requested",
    }),
    reason: z.string().min(10).max(1000).openapi({
      description: "Detailed explanation for leave",
      example: "Attending family function in hometown",
    }),
    startAt: z.string().datetime().openapi({
      description:
        "Departure date and time in ISO format (cannot be in the past for QR leaves)",
      example: "2026-11-01T08:00:00.000Z",
    }),
    endAt: z.string().datetime().openapi({
      description:
        "Expected return date and time in ISO format (must be after startAt)",
      example: "2026-11-03T18:00:00.000Z",
    }),
    submittedForm: z.record(z.string(), z.unknown()).optional().openapi({
      description: "Dynamic form field responses required by leave type schema",
    }),
    pocId: z.string().uuid().optional().openapi({
      description: "Optional point-of-contact staff user ID",
    }),
    approvalContactId: z.string().uuid().optional().openapi({
      description:
        "Contact ID belonging to the authenticated student who should receive the parent approval notification.",
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
  })
);

const approveLeaveBodySchema = registry.register(
  "ApproveLeaveRequest",
  z.object({
    decision: z.enum(["APPROVED", "REJECTED"]).openapi({
      description: "Approver decision for the active workflow step",
      example: "APPROVED",
    }),
    comments: z.string().optional().openapi({
      description: "Optional review comments or rejection rationale",
      example: "Medical document verified.",
    }),
    rejectionCategory: z.string().optional().openapi({
      description:
        "Structured category code if rejected (e.g. POLICY_VIOLATION, MISSING_DOCUMENTS)",
    }),
    forceOverride: z.boolean().optional().openapi({
      description: "Superadmin override flag to bypass approval steps",
    }),
    documentsVerified: z.boolean().optional().openapi({
      description: "Confirmation that uploaded documents were checked",
    }),
    ccEmails: z.array(z.string().email()).optional().openapi({
      description:
        "Staff email addresses to CC on student/parent decision notification",
    }),
  })
);

const cancelLeaveBodySchema = registry.register(
  "CancelLeaveRequest",
  z.object({
    reason: z.string().optional().openapi({
      description: "Optional cancellation reason provided by student",
      example: "Trip cancelled.",
    }),
  })
);

export function registerLeaveRoutes() {
  // POST /api/v1/leaves
  registry.registerPath({
    method: "post",
    path: "/api/v1/leaves",
    summary: "Submit a new leave request",
    description:
      "Creates a new pending leave request under the leave type's configured workflow. Authenticated student can specify an approvalContactId for parent approval routing.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: createLeaveBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Leave request created successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "CreateLeaveSuccessResponse",
              leaveResponseSchema
            ),
          },
        },
      },
      400: {
        description:
          "Validation error: invalid fields, endAt not after startAt, startAt in past for QR leaves, or selected approvalContactId does not belong to the authenticated student",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      403: {
        description: "Only students can create leave requests",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      409: {
        description:
          "Conflict error: policy restriction or overlapping active leave window",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/v1/leaves
  registry.registerPath({
    method: "get",
    path: "/api/v1/leaves",
    summary: "List leave requests",
    description:
      "Retrieves leave requests with optional filtering by status, student, leave type, hostel, date range, and pagination.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      query: z.object({
        studentId: z.string().uuid().optional(),
        status: z.string().optional(),
        leaveTypeId: z.string().uuid().optional(),
        hostelId: z.string().uuid().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        search: z.string().optional(),
        page: z.coerce.number().int().positive().default(1).optional(),
        limit: z.coerce.number().int().positive().max(100).default(20).optional(),
        sortBy: z
          .enum(["startAt", "endAt", "status", "requestNumber", "createdAt"])
          .optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      }),
    },
    responses: {
      200: {
        description: "List of leaves matching the filters",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ListLeavesSuccessResponse",
              z.array(leaveResponseSchema)
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
      403: {
        description: "Forbidden",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // POST /api/v1/leaves/{id}/approve
  registry.registerPath({
    method: "post",
    path: "/api/v1/leaves/{id}/approve",
    summary: "Approve or reject a leave request step",
    description:
      "Submits an approval decision for the current step in the workflow chain (POC, Warden, Admin, or Superadmin override).",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Leave request UUID" }),
      }),
      body: {
        content: {
          "application/json": {
            schema: approveLeaveBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Decision recorded and workflow advanced",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ApproveLeaveSuccessResponse",
              z.object({
                status: z.string().openapi({ example: "APPROVED" }),
              })
            ),
          },
        },
      },
      400: {
        description: "Invalid decision payload or missing required comments",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      403: {
        description:
          "Forbidden: user is not assigned to or authorized for this approval step",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      404: {
        description: "Leave request or approval step not found",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      409: {
        description: "Leave request is not in an actionable state",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // POST /api/v1/leaves/{id}/cancel
  registry.registerPath({
    method: "post",
    path: "/api/v1/leaves/{id}/cancel",
    summary: "Cancel a leave request",
    description:
      "Allows a student to cancel their own pending or approved leave before departure.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Leave request UUID" }),
      }),
      body: {
        content: {
          "application/json": {
            schema: cancelLeaveBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Leave successfully cancelled",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "CancelLeaveSuccessResponse",
              z.object({
                status: z.literal("CANCELLED"),
              })
            ),
          },
        },
      },
      400: {
        description: "Leave cannot be cancelled in its current state",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      403: {
        description: "Students can only cancel their own leaves",
        content: {
          "application/json": { schema: apiErrorSchema },
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
}
