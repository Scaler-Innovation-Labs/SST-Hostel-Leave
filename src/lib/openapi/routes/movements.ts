import { z } from "zod";

import { apiErrorSchema, createSuccessResponseSchema, registry } from "../registry";

const qrPassResultSchema = registry.register(
  "QrPassResult",
  z.object({
    passId: z.string().uuid(),
    tokenHash: z.string().openapi({ example: "d41d8cd98f00b204e9800998ecf8427e..." }),
    qrType: z.string().openapi({ example: "LEAVE_EXIT" }),
    expiresAt: z.string().datetime().nullable(),
  })
);

const scanPreviewResultSchema = registry.register(
  "ScanPreviewResult",
  z.object({
    valid: z.boolean(),
    reason: z.string().optional(),
    scanType: z.enum(["EXIT_SCAN", "RETURN_SCAN"]).optional(),
    student: z
      .object({
        name: z.string(),
        rollNumber: z.string().nullable(),
        roomNumber: z.string().nullable(),
        hostelName: z.string().nullable(),
      })
      .optional(),
    leave: z
      .object({
        typeName: z.string().nullable(),
        startAt: z.string().datetime(),
        endAt: z.string().datetime(),
        status: z.string(),
      })
      .optional(),
  })
);

const scanResultSchema = registry.register(
  "ScanResult",
  z.object({
    scanLogId: z.string().uuid(),
    success: z.boolean(),
    scanType: z.enum(["EXIT_SCAN", "RETURN_SCAN"]).optional(),
    movementEventId: z.string().uuid().optional(),
    failureReason: z.string().optional(),
  })
);

const movementEventSchema = registry.register(
  "MovementEvent",
  z.object({
    id: z.string().uuid(),
    studentId: z.string().uuid(),
    leaveRequestId: z.string().uuid().nullable(),
    eventType: z.enum(["EXIT", "RETURN"]),
    occurredAt: z.string().datetime(),
    guardUserId: z.string().uuid().nullable(),
    source: z.enum(["QR_SCAN", "MANUAL"]),
    studentName: z.string().optional(),
    studentRollNumber: z.string().optional(),
  })
);

const overdueReturnSchema = registry.register(
  "OverdueReturn",
  z.object({
    leaveId: z.string().uuid(),
    studentId: z.string().uuid(),
    studentName: z.string(),
    rollNumber: z.string(),
    phone: z.string().nullable(),
    roomNumber: z.string().nullable(),
    hostelName: z.string().nullable(),
    expectedReturnAt: z.string().datetime(),
    actualExitAt: z.string().datetime().nullable(),
    overdueMinutes: z.number().openapi({ example: 45 }),
  })
);

export function registerMovementRoutes() {
  // POST /api/v1/movements/generate-qr
  registry.registerPath({
    method: "post",
    path: "/api/v1/movements/generate-qr",
    summary: "Issue or rotate an active gate pass QR",
    description:
      "Generates an active gate pass QR for an approved leave request. Gate passes are displayed for 20 seconds. Setting regenerate=true mints a fresh token credential on the server, immediately invalidating any prior screenshots.",
    security: [{ BearerAuth: [] }],
    tags: ["Movement & Gate Control"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              leaveRequestId: z.string().uuid(),
              qrType: z.enum(["LEAVE_EXIT", "LEAVE_RETURN"]),
              regenerate: z.boolean().optional().openapi({
                description:
                  "Whether to rotate the secret token and invalidate previous screenshots",
                example: true,
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Active QR pass token generated or rotated",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("GenerateQrSuccessResponse", qrPassResultSchema),
          },
        },
      },
      400: {
        description: "Invalid leave state or leave is not approved",
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
    },
  });

  // POST /api/v1/movements/scan/preview
  registry.registerPath({
    method: "post",
    path: "/api/v1/movements/scan/preview",
    summary: "Guard scan preview (read-only verification)",
    description:
      "Validates a scanned QR pass token and returns the student and leave details for visual security verification without committing a gate movement event.",
    security: [{ BearerAuth: [] }],
    tags: ["Movement & Gate Control"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              token: z.string().openapi({
                description: "Scanned QR token string payload",
              }),
              latitude: z.number().optional(),
              longitude: z.number().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Scan preview details retrieved",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("ScanPreviewSuccessResponse", scanPreviewResultSchema),
          },
        },
      },
      400: {
        description: "Invalid or expired QR token",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // POST /api/v1/movements/scan
  registry.registerPath({
    method: "post",
    path: "/api/v1/movements/scan",
    summary: "Commit gate scan (exit or return)",
    description:
      "Performs atomic verification and commits a gate exit or return movement transition, updating the leave state and invalidating used passes.",
    security: [{ BearerAuth: [] }],
    tags: ["Movement & Gate Control"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              token: z.string(),
              latitude: z.number().optional(),
              longitude: z.number().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Movement committed successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("ScanCommitSuccessResponse", scanResultSchema),
          },
        },
      },
      400: {
        description: "Invalid scan, gate sequence violation, or expired token",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/v1/movements
  registry.registerPath({
    method: "get",
    path: "/api/v1/movements",
    summary: "List gate movement log events",
    description: "Returns historical audit trail of physical gate entries and exits.",
    security: [{ BearerAuth: [] }],
    tags: ["Movement & Gate Control"],
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        studentId: z.string().uuid().optional(),
        eventType: z.enum(["EXIT", "RETURN"]).optional(),
      }),
    },
    responses: {
      200: {
        description: "Movement logs retrieved",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "MovementLogsResponse",
              z.object({
                items: z.array(movementEventSchema),
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

  // POST /api/v1/movements/manual-checkout
  registry.registerPath({
    method: "post",
    path: "/api/v1/movements/manual-checkout",
    summary: "Manual gate exit override",
    description:
      "Security guard or admin manual exit logging when a student cannot scan a QR code.",
    security: [{ BearerAuth: [] }],
    tags: ["Movement & Gate Control"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              studentId: z.string().uuid(),
              leaveRequestId: z.string().uuid(),
              reason: z.string().min(5).openapi({
                example: "Student phone battery exhausted; verified physical student ID card.",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Manual exit recorded",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ManualCheckoutResponse",
              z.object({
                success: z.boolean(),
                movementEventId: z.string().uuid(),
              })
            ),
          },
        },
      },
    },
  });

  // POST /api/v1/movements/manual-return
  registry.registerPath({
    method: "post",
    path: "/api/v1/movements/manual-return",
    summary: "Manual gate return override",
    description:
      "Security guard or admin manual return check-in when a student returns to campus without pass access.",
    security: [{ BearerAuth: [] }],
    tags: ["Movement & Gate Control"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              studentId: z.string().uuid(),
              leaveRequestId: z.string().uuid().optional(),
              reason: z.string().min(5).openapi({
                example: "Manual gate return checked by main gate guard.",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Manual return recorded",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ManualReturnResponse",
              z.object({
                success: z.boolean(),
                movementEventId: z.string().uuid(),
              })
            ),
          },
        },
      },
    },
  });

  // GET /api/v1/overdue
  registry.registerPath({
    method: "get",
    path: "/api/v1/overdue",
    summary: "List overdue students",
    description:
      "Lists all students currently checked out past their approved return time for safety tracking and warden follow-up.",
    security: [{ BearerAuth: [] }],
    tags: ["Movement & Gate Control"],
    responses: {
      200: {
        description: "List of overdue returns",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("OverdueListResponse", z.array(overdueReturnSchema)),
          },
        },
      },
    },
  });

  // GET /api/v1/overdue/count
  registry.registerPath({
    method: "get",
    path: "/api/v1/overdue/count",
    summary: "Count of currently overdue students",
    description:
      "Lightweight count query optimized for sidebar badges without payload overhead.",
    security: [{ BearerAuth: [] }],
    tags: ["Movement & Gate Control"],
    responses: {
      200: {
        description: "Overdue count",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "OverdueCountResponse",
              z.object({ count: z.number().openapi({ example: 0 }) })
            ),
          },
        },
      },
    },
  });
}
