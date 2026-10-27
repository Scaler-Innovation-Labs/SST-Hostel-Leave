import { z } from "zod";

import { apiErrorSchema, createSuccessResponseSchema, registry } from "../registry";

export function registerApprovalRoutes() {
  // GET /api/v1/approvals
  registry.registerPath({
    method: "get",
    path: "/api/v1/approvals",
    summary: "List pending approvals queue",
    description:
      "Retrieves leave approval requests awaiting action from the authenticated approver. Scoped automatically by approver role, hostel, or department.",
    security: [{ BearerAuth: [] }],
    tags: ["Approvals Queue"],
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
        limit: z.coerce.number().int().min(1).max(50).optional().openapi({ example: 20 }),
        status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
        stepKey: z.string().optional().openapi({
          description: "Filter by active workflow step key (e.g. WARDEN, POC, ADMIN)",
        }),
        leaveTypeId: z.string().uuid().optional(),
        search: z.string().optional().openapi({
          description: "Search student name or roll number",
        }),
      }),
    },
    responses: {
      200: {
        description: "Approval queue items retrieved successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ApprovalQueueResponse",
              z.object({
                items: z.array(
                  z.object({
                    approvalId: z.string().uuid(),
                    leaveRequestId: z.string().uuid(),
                    requestNumber: z.string().openapi({ example: "LR-1042" }),
                    stepKey: z.string().openapi({ example: "WARDEN" }),
                    stepOrder: z.number(),
                    studentName: z.string(),
                    studentRollNumber: z.string(),
                    roomNumber: z.string().nullable(),
                    hostelName: z.string().nullable(),
                    leaveTypeName: z.string(),
                    startAt: z.string().datetime(),
                    endAt: z.string().datetime(),
                    reason: z.string(),
                    appliedAt: z.string().datetime(),
                    previousComments: z.array(
                      z.object({
                        stepKey: z.string(),
                        decision: z.string(),
                        comments: z.string().nullable(),
                        actedAt: z.string().datetime(),
                      })
                    ).optional(),
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
      401: {
        description: "Authentication required",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      403: {
        description: "User is not authorized as an approver",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });
}
