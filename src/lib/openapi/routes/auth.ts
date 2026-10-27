import { z } from "zod";

import { apiErrorSchema, createSuccessResponseSchema, registry } from "../registry";

export function registerAuthRoutes() {
  // GET /api/v1/me/roles
  registry.registerPath({
    method: "get",
    path: "/api/v1/me/roles",
    summary: "List assigned roles and active role",
    description:
      "Returns all role consoles assigned to the authenticated user along with their currently active session role.",
    security: [{ BearerAuth: [] }],
    tags: ["Auth & Identity"],
    responses: {
      200: {
        description: "Assigned roles and active role retrieved",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "UserRolesResponse",
              z.object({
                roles: z.array(
                  z.object({
                    role: z.string().openapi({ example: "STUDENT" }),
                    label: z.string().openapi({ example: "Student" }),
                    dashboardHref: z.string().openapi({ example: "/student/dashboard" }),
                  })
                ),
                activeRole: z.string().openapi({ example: "STUDENT" }),
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

  // GET /api/v1/me/active-role
  registry.registerPath({
    method: "get",
    path: "/api/v1/me/active-role",
    summary: "Get current active role",
    description:
      "Resolves the active role for the current authenticated user session.",
    security: [{ BearerAuth: [] }],
    tags: ["Auth & Identity"],
    responses: {
      200: {
        description: "Active role retrieved",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ActiveRoleResponse",
              z.object({
                activeRole: z.string().openapi({ example: "POC" }),
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

  // POST /api/v1/me/active-role
  registry.registerPath({
    method: "post",
    path: "/api/v1/me/active-role",
    summary: "Switch active role",
    description:
      "Switches the active role for a multi-role user (e.g. POC switching to ADMIN) and updates the session cookie.",
    security: [{ BearerAuth: [] }],
    tags: ["Auth & Identity"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              role: z.string().openapi({
                description: "Target role to activate",
                example: "ADMIN",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Active role successfully updated",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "SwitchActiveRoleSuccessResponse",
              z.object({
                activeRole: z.string(),
                dashboardHref: z.string(),
              })
            ),
          },
        },
      },
      400: {
        description: "Invalid role specified or role not assigned to user",
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
}
