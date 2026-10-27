import { z } from "zod";

import { apiErrorSchema, createSuccessResponseSchema, registry } from "../registry";

const leaveTypeSchema = registry.register(
  "LeaveType",
  z.object({
    id: z.string().uuid(),
    name: z.string().openapi({ example: "Weekend Home Visit" }),
    code: z.string().openapi({ example: "WEEKEND" }),
    description: z.string().nullable(),
    requiresParentApproval: z.boolean(),
    requiresGuardScan: z.boolean(),
    formSchema: z.record(z.string(), z.unknown()).nullable().openapi({
      description: "JSON Schema definition for dynamic leave form fields",
    }),
    workflowDefinitionId: z.string().uuid().nullable(),
    isActive: z.boolean(),
  })
);

const policySchema = registry.register(
  "CampusPolicy",
  z.object({
    id: z.string().uuid(),
    name: z.string().openapi({ example: "Maximum Leaves Per Month" }),
    code: z.string().openapi({ example: "MAX_MONTHLY_LEAVES" }),
    ruleConfig: z.record(z.string(), z.unknown()),
    isActive: z.boolean(),
  })
);

const auditLogSchema = registry.register(
  "AuditLogEntry",
  z.object({
    id: z.string().uuid(),
    userId: z.string().uuid().nullable(),
    action: z.string().openapi({ example: "LEAVE_STATUS_OVERRIDE" }),
    entityType: z.string().openapi({ example: "LEAVE_REQUEST" }),
    entityId: z.string().uuid(),
    oldData: z.record(z.string(), z.unknown()).nullable(),
    newData: z.record(z.string(), z.unknown()).nullable(),
    ipAddress: z.string().nullable(),
    timestamp: z.string().datetime(),
  })
);

export function registerAdminRoutes() {
  // GET /api/v1/leave-types
  registry.registerPath({
    method: "get",
    path: "/api/v1/leave-types",
    summary: "List active leave categories",
    description:
      "Public/student reference endpoint returning currently available leave types for new leave requests.",
    security: [{ BearerAuth: [] }],
    tags: ["Administration & System"],
    responses: {
      200: {
        description: "Active leave types",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("ActiveLeaveTypesResponse", z.array(leaveTypeSchema)),
          },
        },
      },
    },
  });

  // GET /api/v1/admin/leave-types
  registry.registerPath({
    method: "get",
    path: "/api/v1/admin/leave-types",
    summary: "Full leave type configuration list",
    description:
      "Returns complete leave type configurations including inactive items, approval workflow mappings, and dynamic form schemas.",
    security: [{ BearerAuth: [] }],
    tags: ["Administration & System"],
    responses: {
      200: {
        description: "Full leave types configuration list",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("AdminLeaveTypesResponse", z.array(leaveTypeSchema)),
          },
        },
      },
    },
  });

  // POST /api/v1/admin/leave-types
  registry.registerPath({
    method: "post",
    path: "/api/v1/admin/leave-types",
    summary: "Create leave type",
    description:
      "Defines a new leave category with dynamic form validation schema and approval chain. Super Admin only.",
    security: [{ BearerAuth: [] }],
    tags: ["Administration & System"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().min(2),
              code: z.string().min(2),
              description: z.string().optional(),
              requiresParentApproval: z.boolean().default(true),
              requiresGuardScan: z.boolean().default(true),
              formSchema: z.record(z.string(), z.unknown()).optional(),
              workflowDefinitionId: z.string().uuid().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Leave type successfully created",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("CreateLeaveTypeResponse", leaveTypeSchema),
          },
        },
      },
    },
  });

  // POST /api/v1/admin/leaves/{id}/override
  registry.registerPath({
    method: "post",
    path: "/api/v1/admin/leaves/{id}/override",
    summary: "Emergency leave status override",
    description:
      "Allows Super Admin to directly transition a leave request state (e.g. force-complete, revoke, or emergency-approve) with mandatory audit justification.",
    security: [{ BearerAuth: [] }],
    tags: ["Administration & System"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Leave Request ID" }),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              targetStatus: z.enum(["APPROVED", "REJECTED", "CANCELLED", "COMPLETED"]).openapi({
                example: "APPROVED",
              }),
              justification: z.string().min(10).openapi({
                example: "Emergency family hospitalization verified by campus warden.",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Leave status overridden successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "OverrideSuccessResponse",
              z.object({
                leaveId: z.string().uuid(),
                newStatus: z.string(),
              })
            ),
          },
        },
      },
      403: {
        description: "Super Admin privileges required",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/v1/policies
  registry.registerPath({
    method: "get",
    path: "/api/v1/policies",
    summary: "List leave policies",
    description: "Returns campus policy engine rules and quota restrictions.",
    security: [{ BearerAuth: [] }],
    tags: ["Administration & System"],
    responses: {
      200: {
        description: "List of policies",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("PoliciesListResponse", z.array(policySchema)),
          },
        },
      },
    },
  });

  // POST /api/v1/policies
  registry.registerPath({
    method: "post",
    path: "/api/v1/policies",
    summary: "Create campus policy rule",
    description: "Configures a new constraint rule in the policy engine.",
    security: [{ BearerAuth: [] }],
    tags: ["Administration & System"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().min(2),
              code: z.string().min(2),
              ruleConfig: z.record(z.string(), z.unknown()),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Policy created",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("CreatePolicyResponse", policySchema),
          },
        },
      },
    },
  });

  // GET /api/v1/audit
  registry.registerPath({
    method: "get",
    path: "/api/v1/audit",
    summary: "Query audit log trail",
    description:
      "Queries the tamper-evident audit log stream with filtering by actor, action type, entity, and date range.",
    security: [{ BearerAuth: [] }],
    tags: ["Administration & System"],
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.string().uuid().optional(),
      }),
    },
    responses: {
      200: {
        description: "Audit trail log records",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "AuditLogQueryResponse",
              z.object({
                items: z.array(auditLogSchema),
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
      403: {
        description: "Super Admin privileges required",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/health
  registry.registerPath({
    method: "get",
    path: "/api/health",
    summary: "System health check",
    description:
      "Performs real-time readiness check verifying PostgreSQL database pool connectivity, memory usage, and uptime.",
    tags: ["Administration & System"],
    responses: {
      200: {
        description: "System is healthy and operational",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "HealthCheckResponse",
              z.object({
                status: z.literal("ok"),
                timestamp: z.string().datetime(),
                uptime: z.number(),
                database: z.object({
                  status: z.string(),
                  latencyMs: z.number(),
                }),
              })
            ),
          },
        },
      },
      503: {
        description: "One or more infrastructure subsystems degraded",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });
}
