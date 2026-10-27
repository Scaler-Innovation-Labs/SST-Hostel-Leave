import { z } from "zod";

import { apiErrorSchema, createSuccessResponseSchema, registry } from "../registry";

const studentProfileSchema = registry.register(
  "StudentProfile",
  z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    rollNumber: z.string().openapi({ example: "23BCS041" }),
    roomNumber: z.string().nullable().openapi({ example: "B-204" }),
    hostelId: z.string().uuid().nullable(),
    departmentId: z.string().uuid().nullable(),
    academicGroupId: z.string().uuid().nullable(),
    status: z.string().openapi({ example: "ACTIVE" }),
    user: z.object({
      id: z.string().uuid(),
      name: z.string().openapi({ example: "Alex Smith" }),
      email: z.string().email(),
      phone: z.string().nullable().openapi({ example: "+919876543210" }),
    }),
  })
);

export function registerStudentRoutes() {
  // GET /api/v1/students/contacts
  registry.registerPath({
    method: "get",
    path: "/api/v1/students/contacts",
    summary: "List student emergency and parent contacts",
    description:
      "Retrieves verified parent and emergency contacts linked to the authenticated student for leave approval selection.",
    security: [{ BearerAuth: [] }],
    tags: ["Students & Contacts"],
    responses: {
      200: {
        description: "Student contacts retrieved successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "StudentContactsResponse",
              z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string().openapi({ example: "Robert Smith" }),
                  relationship: z.string().openapi({ example: "FATHER" }),
                  phone: z.string().openapi({ example: "+919876543210" }),
                  email: z.string().email().nullable(),
                  isPrimary: z.boolean(),
                })
              )
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
        description: "Only students can access their contacts",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/v1/students
  registry.registerPath({
    method: "get",
    path: "/api/v1/students",
    summary: "List and filter students",
    description:
      "Lists students with pagination and filtering by hostel, department, academic group, or search term. Accessible by POC, Admin, and Super Admin.",
    security: [{ BearerAuth: [] }],
    tags: ["Students & Contacts"],
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
        limit: z.coerce.number().int().min(1).max(100).optional().openapi({ example: 20 }),
        search: z.string().optional(),
        hostelId: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
        academicGroupId: z.string().uuid().optional(),
        status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED"]).optional(),
      }),
    },
    responses: {
      200: {
        description: "Paginated list of students",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "PaginatedStudentsResponse",
              z.object({
                items: z.array(studentProfileSchema),
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
        description: "Insufficient permissions",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // POST /api/v1/students
  registry.registerPath({
    method: "post",
    path: "/api/v1/students",
    summary: "Create a student profile",
    description:
      "Provisions a new student account and profile with room and academic assignments. Accessible by Super Admin.",
    security: [{ BearerAuth: [] }],
    tags: ["Students & Contacts"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.string().email(),
              name: z.string().min(2),
              rollNumber: z.string().min(2),
              phone: z.string().optional(),
              roomNumber: z.string().optional(),
              hostelId: z.string().uuid().optional(),
              departmentId: z.string().uuid().optional(),
              academicGroupId: z.string().uuid().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Student created successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("CreateStudentResponse", studentProfileSchema),
          },
        },
      },
      400: {
        description: "Validation error or missing fields",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      409: {
        description: "Roll number or email already in use",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/v1/students/{id}
  registry.registerPath({
    method: "get",
    path: "/api/v1/students/{id}",
    summary: "Get student details by ID",
    description:
      "Retrieves complete student details including academic affiliations, room assignments, and guardian contacts.",
    security: [{ BearerAuth: [] }],
    tags: ["Students & Contacts"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Student ID" }),
      }),
    },
    responses: {
      200: {
        description: "Student details retrieved",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("StudentDetailResponse", studentProfileSchema),
          },
        },
      },
      404: {
        description: "Student not found",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // PUT /api/v1/students/{id}
  registry.registerPath({
    method: "put",
    path: "/api/v1/students/{id}",
    summary: "Update student details",
    description:
      "Updates student profile information, room assignments, or academic affiliations. Accessible by Super Admin.",
    security: [{ BearerAuth: [] }],
    tags: ["Students & Contacts"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Student ID" }),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().optional(),
              phone: z.string().optional(),
              roomNumber: z.string().optional(),
              hostelId: z.string().uuid().optional(),
              departmentId: z.string().uuid().optional(),
              academicGroupId: z.string().uuid().optional(),
              status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED"]).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Student updated successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("UpdateStudentResponse", studentProfileSchema),
          },
        },
      },
      404: {
        description: "Student not found",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // POST /api/v1/students/bulk
  registry.registerPath({
    method: "post",
    path: "/api/v1/students/bulk",
    summary: "Bulk import students",
    description:
      "Imports multiple student records in a batch transaction with rollback support. Accessible by Super Admin.",
    security: [{ BearerAuth: [] }],
    tags: ["Students & Contacts"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              students: z.array(
                z.object({
                  email: z.string().email(),
                  name: z.string(),
                  rollNumber: z.string(),
                  phone: z.string().optional(),
                  roomNumber: z.string().optional(),
                  hostelName: z.string().optional(),
                  departmentName: z.string().optional(),
                  academicGroupName: z.string().optional(),
                })
              ),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Bulk import summary",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "BulkStudentImportResponse",
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
