import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Security Scheme: Clerk Session Bearer Token / Cookie Session
registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Clerk session authentication token (or browser session cookie)",
});

// Standard API Error Response
export const apiErrorSchema = registry.register(
  "ApiError",
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: "VALIDATION_ERROR" }),
      message: z.string().openapi({
        example: "Selected contact does not belong to this student",
      }),
      details: z.unknown().optional(),
    }),
  })
);

export function createSuccessResponseSchema<T extends z.ZodTypeAny>(
  name: string,
  dataSchema: T
) {
  return registry.register(
    name,
    z.object({
      success: z.literal(true),
      data: dataSchema,
    })
  );
}
