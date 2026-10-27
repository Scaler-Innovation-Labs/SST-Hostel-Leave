import { z } from "zod";

import { createSuccessResponseSchema, registry } from "../registry";

const hostelSchema = registry.register(
  "Hostel",
  z.object({
    id: z.string().uuid(),
    name: z.string().openapi({ example: "Cauvery Block" }),
    code: z.string().openapi({ example: "CAU" }),
    gender: z.enum(["MALE", "FEMALE", "COED"]),
    capacity: z.number().int().optional(),
    isActive: z.boolean(),
  })
);

const departmentSchema = registry.register(
  "Department",
  z.object({
    id: z.string().uuid(),
    name: z.string().openapi({ example: "Computer Science & Engineering" }),
    code: z.string().openapi({ example: "CSE" }),
    isActive: z.boolean(),
  })
);

const academicGroupSchema = registry.register(
  "AcademicGroup",
  z.object({
    id: z.string().uuid(),
    name: z.string().openapi({ example: "Batch of 2027" }),
    departmentId: z.string().uuid().nullable(),
    academicYear: z.string().openapi({ example: "2026-2027" }),
    isActive: z.boolean(),
  })
);

export function registerStructureRoutes() {
  // GET /api/v1/hostels
  registry.registerPath({
    method: "get",
    path: "/api/v1/hostels",
    summary: "List hostel blocks",
    description: "Returns campus hostel blocks accessible to the current staff role.",
    security: [{ BearerAuth: [] }],
    tags: ["Hostel & Academic Structure"],
    responses: {
      200: {
        description: "List of hostels",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("HostelsListResponse", z.array(hostelSchema)),
          },
        },
      },
    },
  });

  // POST /api/v1/hostels
  registry.registerPath({
    method: "post",
    path: "/api/v1/hostels",
    summary: "Create a hostel block",
    description: "Configures a new hostel residence block. Accessible by Super Admin.",
    security: [{ BearerAuth: [] }],
    tags: ["Hostel & Academic Structure"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().min(2),
              code: z.string().min(2),
              gender: z.enum(["MALE", "FEMALE", "COED"]),
              capacity: z.number().int().positive().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Hostel created",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("CreateHostelResponse", hostelSchema),
          },
        },
      },
    },
  });

  // GET /api/v1/departments
  registry.registerPath({
    method: "get",
    path: "/api/v1/departments",
    summary: "List academic departments",
    description: "Retrieves departments offering degree programs.",
    security: [{ BearerAuth: [] }],
    tags: ["Hostel & Academic Structure"],
    responses: {
      200: {
        description: "List of departments",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("DepartmentsListResponse", z.array(departmentSchema)),
          },
        },
      },
    },
  });

  // POST /api/v1/departments
  registry.registerPath({
    method: "post",
    path: "/api/v1/departments",
    summary: "Create an academic department",
    description: "Registers a new academic department. Super Admin only.",
    security: [{ BearerAuth: [] }],
    tags: ["Hostel & Academic Structure"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().min(2),
              code: z.string().min(2),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Department created",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("CreateDepartmentResponse", departmentSchema),
          },
        },
      },
    },
  });

  // GET /api/v1/academic-groups
  registry.registerPath({
    method: "get",
    path: "/api/v1/academic-groups",
    summary: "List academic groups & cohorts",
    description: "Retrieves student batches and cohorts mapped to departments.",
    security: [{ BearerAuth: [] }],
    tags: ["Hostel & Academic Structure"],
    responses: {
      200: {
        description: "List of academic groups",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("AcademicGroupsListResponse", z.array(academicGroupSchema)),
          },
        },
      },
    },
  });

  // POST /api/v1/academic-groups
  registry.registerPath({
    method: "post",
    path: "/api/v1/academic-groups",
    summary: "Create an academic cohort",
    description: "Registers a new student batch or section.",
    security: [{ BearerAuth: [] }],
    tags: ["Hostel & Academic Structure"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().min(2),
              departmentId: z.string().uuid().optional(),
              academicYear: z.string(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Academic group created",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("CreateAcademicGroupResponse", academicGroupSchema),
          },
        },
      },
    },
  });
}
