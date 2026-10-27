import { z } from "zod";

import { apiErrorSchema, createSuccessResponseSchema, registry } from "../registry";

const leaveResponseSchema = registry.register(
  "LeaveRequest",
  z.object({
    id: z.string().uuid(),
    requestNumber: z.string().openapi({ example: "LR-1042" }),
    studentId: z.string().uuid(),
    leaveTypeId: z.string().uuid(),
    status: z.string().openapi({ example: "PENDING" }),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string(),
    submittedAt: z.string().datetime(),
  })
);

const leaveDetailSchema = registry.register(
  "LeaveDetail",
  leaveResponseSchema.extend({
    student: z.object({
      name: z.string(),
      rollNumber: z.string(),
      roomNumber: z.string().nullable(),
      hostelName: z.string().nullable(),
    }).optional(),
    leaveType: z.object({
      name: z.string(),
      code: z.string(),
    }).optional(),
    approvalSteps: z.array(
      z.object({
        stepKey: z.string(),
        stepOrder: z.number(),
        decision: z.string(),
        comments: z.string().nullable(),
        actedAt: z.string().datetime().nullable(),
        actedByUserName: z.string().nullable(),
      })
    ).optional(),
  })
);

const createLeaveBodySchema = registry.register(
  "CreateLeaveRequest",
  z.object({
    leaveTypeId: z.string().uuid().openapi({
      description: "UUID of the leave type being requested",
    }),
    reason: z.string().min(10).max(1000).openapi({
      description: "Detailed explanation for leave",
      example: "Attending family function in hometown",
    }),
    startAt: z.string().datetime().openapi({
      description:
        "Departure date and time in ISO format (cannot be in the past for QR leaves)",
      example: "2026-11-01T08:00:00.000Z",
    }),
    endAt: z.string().datetime().openapi({
      description:
        "Expected return date and time in ISO format (must be after startAt)",
      example: "2026-11-03T18:00:00.000Z",
    }),
    submittedForm: z.record(z.string(), z.unknown()).optional().openapi({
      description: "Dynamic form field responses required by leave type schema",
    }),
    pocId: z.string().uuid().optional().openapi({
      description: "Optional point-of-contact staff user ID",
    }),
    approvalContactId: z.string().uuid().optional().openapi({
      description:
        "Contact ID belonging to the authenticated student who should receive the parent approval notification.",
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
  })
);

const approveLeaveBodySchema = registry.register(
  "ApproveLeaveRequest",
  z.object({
    decision: z.enum(["APPROVED", "REJECTED"]).openapi({
      description: "Approver decision for the active workflow step",
      example: "APPROVED",
    }),
    comments: z.string().optional().openapi({
      description: "Optional review comments or rejection rationale",
      example: "Medical document verified.",
    }),
    rejectionCategory: z.string().optional().openapi({
      description:
        "Structured category code if rejected (e.g. POLICY_VIOLATION, MISSING_DOCUMENTS)",
    }),
    forceOverride: z.boolean().optional().openapi({
      description: "Superadmin override flag to bypass approval steps",
    }),
    documentsVerified: z.boolean().optional().openapi({
      description: "Confirmation that uploaded documents were checked",
    }),
    ccEmails: z.array(z.string().email()).optional().openapi({
      description:
        "Staff email addresses to CC on student/parent decision notification",
    }),
  })
);

const cancelLeaveBodySchema = registry.register(
  "CancelLeaveRequest",
  z.object({
    reason: z.string().optional().openapi({
      description: "Optional cancellation reason provided by student",
      example: "Trip cancelled.",
    }),
  })
);

const leaveDocumentSchema = registry.register(
  "LeaveDocument",
  z.object({
    id: z.string().uuid(),
    leaveRequestId: z.string().uuid(),
    documentType: z.string().openapi({ example: "MEDICAL_CERTIFICATE" }),
    fileName: z.string().openapi({ example: "prescription.pdf" }),
    fileSize: z.number(),
    mimeType: z.string().openapi({ example: "application/pdf" }),
    downloadUrl: z.string().url().optional(),
    uploadedAt: z.string().datetime(),
  })
);

const leaveQuestionSchema = registry.register(
  "LeaveQuestion",
  z.object({
    id: z.string().uuid(),
    leaveRequestId: z.string().uuid(),
    question: z.string().openapi({ example: "Please attach parent consent letter." }),
    askedByUserId: z.string().uuid(),
    answer: z.string().nullable().openapi({ example: "Attached under documents section." }),
    answeredAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
);

export function registerLeaveRoutes() {
  // POST /api/v1/leaves
  registry.registerPath({
    method: "post",
    path: "/api/v1/leaves",
    summary: "Submit a new leave request",
    description:
      "Creates a new pending leave request under the leave type's configured workflow. Authenticated student can specify an approvalContactId for parent approval routing.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: createLeaveBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Leave request created successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "CreateLeaveSuccessResponse",
              leaveResponseSchema
            ),
          },
        },
      },
      400: {
        description:
          "Validation failure (e.g. start date in past for QR leave, end before start, missing form fields, or invalid approvalContactId)",
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
        description: "Selected contact does not belong to the student or lacks a phone number",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      409: {
        description: "Overlapping active leave exists for this student",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // GET /api/v1/leaves
  registry.registerPath({
    method: "get",
    path: "/api/v1/leaves",
    summary: "List and filter leave requests",
    description:
      "Retrieves leave requests with pagination and status/date filtering. Students view their own leaves; staff view leaves scoped by their role and assigned hostels.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      query: z.object({
        page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
        limit: z.coerce.number().int().min(1).max(100).optional().openapi({ example: 20 }),
        status: z.enum([
          "DRAFT",
          "PENDING",
          "APPROVED",
          "REJECTED",
          "CANCELLED",
          "COMPLETED",
          "EXPIRED",
        ]).optional(),
        leaveTypeId: z.string().uuid().optional(),
        studentId: z.string().uuid().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      }),
    },
    responses: {
      200: {
        description: "Paginated list of leaves retrieved",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "PaginatedLeavesResponse",
              z.object({
                items: z.array(leaveResponseSchema),
                pagination: z.object({
                  page: z.number().openapi({ example: 1 }),
                  limit: z.number().openapi({ example: 20 }),
                  total: z.number().openapi({ example: 42 }),
                  totalPages: z.number().openapi({ example: 3 }),
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
    },
  });

  // GET /api/v1/leaves/{id}
  registry.registerPath({
    method: "get",
    path: "/api/v1/leaves/{id}",
    summary: "Get full leave details",
    description:
      "Retrieves complete leave record including student details, approval timeline, workflow comments, and gate movements.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Leave request UUID" }),
      }),
    },
    responses: {
      200: {
        description: "Leave details retrieved successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("LeaveDetailSuccessResponse", leaveDetailSchema),
          },
        },
      },
      404: {
        description: "Leave request not found",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // POST /api/v1/leaves/{id}/approve
  registry.registerPath({
    method: "post",
    path: "/api/v1/leaves/{id}/approve",
    summary: "Approve or reject a leave request step",
    description:
      "Approver decision (APPROVE/REJECT) on the current pending workflow step. Advance workflow to next approver or finalize status.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Leave request UUID" }),
      }),
      body: {
        content: {
          "application/json": {
            schema: approveLeaveBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Decision processed successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "ApproveLeaveSuccessResponse",
              z.object({
                status: z.string().openapi({ example: "APPROVED" }),
                nextStepKey: z.string().nullable().openapi({ example: "WARDEN" }),
              })
            ),
          },
        },
      },
      400: {
        description: "Invalid decision or step validation failure",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
      403: {
        description: "User is not authorized to act on this approval step",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // POST /api/v1/leaves/{id}/cancel
  registry.registerPath({
    method: "post",
    path: "/api/v1/leaves/{id}/cancel",
    summary: "Cancel a leave request",
    description:
      "Cancels an active or pending leave request. Students may cancel their own leaves before gate departure.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Leave request UUID" }),
      }),
      body: {
        content: {
          "application/json": {
            schema: cancelLeaveBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Leave request successfully cancelled",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "CancelLeaveSuccessResponse",
              z.object({
                status: z.literal("CANCELLED"),
              })
            ),
          },
        },
      },
      400: {
        description: "Leave cannot be cancelled in its current state",
        content: {
          "application/json": { schema: apiErrorSchema },
        },
      },
    },
  });

  // POST /api/v1/leaves/{id}/complete
  registry.registerPath({
    method: "post",
    path: "/api/v1/leaves/{id}/complete",
    summary: "Mark leave completed",
    description:
      "Staff/warden completion endpoint for non-QR leaves or manual closeout upon verified return.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Leave request UUID" }),
      }),
    },
    responses: {
      200: {
        description: "Leave completed",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema(
              "CompleteLeaveSuccessResponse",
              z.object({ status: z.literal("COMPLETED") })
            ),
          },
        },
      },
    },
  });

  // GET /api/v1/leaves/{id}/documents
  registry.registerPath({
    method: "get",
    path: "/api/v1/leaves/{id}/documents",
    summary: "List uploaded leave documents",
    description: "Returns medical proofs, tickets, or certificates uploaded with the leave.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Leave request UUID" }),
      }),
    },
    responses: {
      200: {
        description: "List of attached documents",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("LeaveDocumentsResponse", z.array(leaveDocumentSchema)),
          },
        },
      },
    },
  });

  // POST /api/v1/leaves/{id}/documents
  registry.registerPath({
    method: "post",
    path: "/api/v1/leaves/{id}/documents",
    summary: "Upload document for leave",
    description:
      "Uploads a supporting document (PDF, PNG, JPG) to S3 and attaches it to the leave request.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid().openapi({ description: "Leave request UUID" }),
      }),
      body: {
        content: {
          "multipart/form-data": {
            schema: z.object({
              file: z.string().openapi({
                type: "string",
                format: "binary",
                description: "Document binary file (max 10MB)",
              }),
              documentType: z.string().openapi({ example: "MEDICAL_CERTIFICATE" }),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Document uploaded successfully",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("UploadDocumentSuccessResponse", leaveDocumentSchema),
          },
        },
      },
    },
  });

  // DELETE /api/v1/leaves/{id}/documents/{documentId}
  registry.registerPath({
    method: "delete",
    path: "/api/v1/leaves/{id}/documents/{documentId}",
    summary: "Delete attached leave document",
    description: "Removes an uploaded document from the leave request before final approval.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid(),
        documentId: z.string().uuid(),
      }),
    },
    responses: {
      200: {
        description: "Document deleted",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("DeleteDocumentResponse", z.object({ success: z.boolean() })),
          },
        },
      },
    },
  });

  // GET /api/v1/leaves/{id}/questions
  registry.registerPath({
    method: "get",
    path: "/api/v1/leaves/{id}/questions",
    summary: "List clarification questions",
    description:
      "Lists questions asked by approvers regarding this leave request along with the student's answers.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    responses: {
      200: {
        description: "Questions list",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("LeaveQuestionsResponse", z.array(leaveQuestionSchema)),
          },
        },
      },
    },
  });

  // POST /api/v1/leaves/{id}/questions
  registry.registerPath({
    method: "post",
    path: "/api/v1/leaves/{id}/questions",
    summary: "Ask clarification question",
    description:
      "Approver sends a clarification question to the student regarding an ambiguous leave request.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid(),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              question: z.string().min(5).max(500).openapi({
                example: "Can you provide the return train ticket details?",
              }),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Question asked",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("AskQuestionResponse", leaveQuestionSchema),
          },
        },
      },
    },
  });

  // POST /api/v1/leaves/{id}/questions/{questionId}/answer
  registry.registerPath({
    method: "post",
    path: "/api/v1/leaves/{id}/questions/{questionId}/answer",
    summary: "Answer clarification question",
    description:
      "Student replies to an approver's clarification question, allowing review to proceed.",
    security: [{ BearerAuth: [] }],
    tags: ["Leaves"],
    request: {
      params: z.object({
        id: z.string().uuid(),
        questionId: z.string().uuid(),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              answer: z.string().min(2).max(1000).openapi({
                example: "Ticket #123456 has been booked on Shatabdi Express arriving 18:00.",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Answer recorded",
        content: {
          "application/json": {
            schema: createSuccessResponseSchema("AnswerQuestionResponse", leaveQuestionSchema),
          },
        },
      },
    },
  });
}
