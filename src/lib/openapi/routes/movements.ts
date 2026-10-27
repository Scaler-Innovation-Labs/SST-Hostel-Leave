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

export function registerMovementRoutes() {
  // POST /api/v1/movements/generate-qr
  registry.registerPath({
    method: "post",
    path: "/api/v1/movements/generate-qr",
    summary: "Issue or rotate an active gate pass QR",
    description:
      "Generates an active gate pass QR for an approved leave request. Gate passes are displayed for 20 seconds. Setting regenerate=true mints a fresh token credential on the server, immediately invalidating any prior screenshots.",
    security: [{ BearerAuth: [] }],
    tags: ["Movement & QR"],
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
      201: {
        description: "QR pass generated or rotated successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "GenerateQrSuccessResponse",
              qrPassResultSchema
            ),
          },
        },
      },
      400: {
        description:
          "Invalid request: leave is not approved, or conflicting QR pass is already active",
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
        description: "Only students can generate QR passes for their own leaves",
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
      429: {
        description: "Rate limit exceeded (max 30 generation requests per minute)",
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
      "Validates a scanned QR pass token and returns the student identity and leave window for guard visual verification without committing any movement state change.",
    security: [{ BearerAuth: [] }],
    tags: ["Movement & QR"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              token: z.string().trim().min(1).max(256).openapi({
                description: "Raw token read from the student's QR code",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Preview verification result",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ScanPreviewSuccessResponse",
              scanPreviewResultSchema
            ),
          },
        },
      },
      400: {
        description: "Invalid token payload",
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
        description: "Only guards or authorized staff can preview scans",
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
    summary: "Commit gate scan (Exit or Return)",
    description:
      "Validates the QR token, checks movement state transitions, logs the scan, and transitions the student's physical location (IN_HOSTEL <-> OUTSIDE_HOSTEL).",
    security: [{ BearerAuth: [] }],
    tags: ["Movement & QR"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              token: z.string().trim().min(1).max(256),
              scanType: z.enum(["EXIT_SCAN", "RETURN_SCAN"]).optional().openapi({
                description:
                  "Optional explicit scan type; if omitted, automatically detected from pass state",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Movement scan successfully committed",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ScanCommitSuccessResponse",
              scanResultSchema
            ),
          },
        },
      },
      400: {
        description:
          "Scan rejected: invalid scan type, token expired, or out-of-order movement",
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
        description: "Only security guards or authorized staff can commit gate scans",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      409: {
        description: "Pass is already used, expired, or invalidated",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });
}
