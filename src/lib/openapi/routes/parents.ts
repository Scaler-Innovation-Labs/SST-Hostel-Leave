import { z } from "zod";

import { apiErrorSchema, createSuccessResponseSchema, registry } from "../registry";

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
          "Invalid decision payload, missing required comments on rejection, or token expired",
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
}
