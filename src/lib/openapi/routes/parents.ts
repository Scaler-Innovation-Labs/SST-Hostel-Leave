import { z } from "zod";

import { apiErrorSchema, createSuccessResponseSchema, registry } from "../registry";

const parentProfileSchema = registry.register(
  "ParentProfile",
  z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    name: z.string().openapi({ example: "Sarah Connor" }),
    email: z.string().email().nullable(),
    phone: z.string().openapi({ example: "+919876543210" }),
    relationship: z.string().openapi({ example: "MOTHER" }),
    studentId: z.string().uuid(),
    isPrimary: z.boolean(),
  })
);

export function registerParentRoutes() {
  // POST /api/parent-approve/{token}/decision
  registry.registerPath({
    method: "post",
    path: "/api/parent-approve/{token}/decision",
    summary: "Parent approval decision via tokenized link",
    description:
      "Allows a parent to approve or reject a leave request directly through their unique tokenized link without requiring account creation or login.",
    tags: ["Parent Portal"],
    request: {
      params: z.object({
        token: z.string().openapi({
          description: "Raw cryptographic approval token from SMS/Email link",
          example: "7f8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
        }),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              decision: z.enum(["APPROVED", "REJECTED"]).openapi({
                description: "Parent decision",
                example: "APPROVED",
              }),
              comments: z.string().max(500).optional().openapi({
                description: "Optional parent remarks or conditions",
                example: "Permission granted for weekend stay at home.",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Parent decision recorded successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ParentDecisionSuccessResponse",
              z.object({
                status: z.enum(["APPROVED", "REJECTED"]),
                message: z.string(),
              })
            ),
          },
        },
      },
      400: {
        description:
          "Invalid decision payload, missing required comments on rejection, or invalid/expired approval link",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      404: {
        description: "Invalid or unknown parent approval link",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      409: {
        description: "Parent decision has already been processed for this leave",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/v1/parents
  registry.registerPath({
    method: "get",
    path: "/api/v1/parents",
    summary: "List parent and guardian records",
    description: "Returns registered parent/guardian contacts. Accessible by staff.",
    security: [{ BearerAuth: [] }],
    tags: ["Parent Portal"],
    request: {
      query: z.object({
        studentId: z.string().uuid().optional(),
        search: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
      }),
    },
    responses: {
      200: {
        description: "List of parent records",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ParentsListResponse",
              z.object({
                items: z.array(parentProfileSchema),
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

  // POST /api/v1/parents
  registry.registerPath({
    method: "post",
    path: "/api/v1/parents",
    summary: "Create parent / guardian record",
    description: "Links a new parent record to a student. Super Admin only.",
    security: [{ BearerAuth: [] }],
    tags: ["Parent Portal"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().min(2),
              phone: z.string().min(10),
              email: z.string().email().optional(),
              relationship: z.string().min(2),
              studentId: z.string().uuid(),
              isPrimary: z.boolean().default(false),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Parent record created",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("CreateParentResponse", parentProfileSchema),
          },
        },
      },
    },
  });

  // POST /api/v1/parents/bulk
  registry.registerPath({
    method: "post",
    path: "/api/v1/parents/bulk",
    summary: "Bulk import parent contacts",
    description: "Uploads parent contact mappings in bulk via CSV/JSON. Super Admin only.",
    security: [{ BearerAuth: [] }],
    tags: ["Parent Portal"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              parents: z.array(
                z.object({
                  name: z.string(),
                  phone: z.string(),
                  email: z.string().email().optional(),
                  relationship: z.string(),
                  studentRollNumber: z.string(),
                  isPrimary: z.boolean().optional(),
                })
              ),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Bulk parent import summary",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "BulkParentImportResponse",
              z.object({
                total: z.number(),
                created: z.number(),
                failed: z.number(),
                errors: z.array(z.string()).optional(),
              })
            ),
          },
        },
      },
    },
  });
}
