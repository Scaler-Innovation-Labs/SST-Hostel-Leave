SST Hostel Leave System — Backend Development Workflow
Purpose

This document defines the standard process for implementing backend features.

All backend functionality must follow this workflow.

The objective is:

consistency
maintainability
architectural compliance
predictable code generation

This workflow applies to:

humans
Copilot
Claude Code
Cursor
future AI agents
Core Principle

Never start by writing routes.

Never start by writing UI.

Never start by writing database queries.

Always start from domain understanding.

Development Order

Every backend feature should be implemented in this order:

Understand Domain

↓

DTO

↓

Repository

↓

Service

↓

Route

↓

UI

↓

Tests

Never reverse the order.

Step 1 — Understand Domain

Before coding answer:

What domain owns this?

What business process is being implemented?

What tables are affected?

What services are involved?

What notifications are triggered?

What audit records are required?
Example

Feature:

Create Leave Request

Domain:

leave

Affected tables:

leave_requests

leave_approvals

audit_logs
Step 2 — Create DTO

Create request contract first.

Location:

src/dto/

Example:

src/dto/leave/create-leave.dto.ts
DTO Template
import { z } from "zod";

export const createLeaveSchema =
  z.object({
    leaveTypeId: z.string().uuid(),

    reason: z.string().min(5),

    startAt: z.string(),

    endAt: z.string(),
  });

export type CreateLeaveDto =
  z.infer<typeof createLeaveSchema>;
DTO Rules

DTOs:

✓ Validate input

✓ Define contracts

✓ Export inferred types

DTOs must not:

✗ Query database

✗ Execute business logic

Step 3 — Repository

Create repository methods.

Location:

src/db/repositories/

Example:

leave.repository.ts
Repository Template
export async function create(
  input: CreateLeaveInput
) {
  return db
    .insert(leaveRequests)
    .values(input)
    .returning();
}
Repository Rules

Repositories:

✓ Query database

✓ Insert data

✓ Update data

✓ Delete data

Repositories must not:

✗ Send notifications

✗ Evaluate policies

✗ Generate QR

✗ Execute workflows

Step 4 — Service

Business logic lives here.

Location:

src/services/

Example:

create-leave.service.ts
Service Template
export async function createLeave(
  dto: CreateLeaveDto,
  currentUser: CurrentUser
) {
  // business logic

  // repository calls

  // notifications

  // audit

  return leave;
}
Service Responsibilities

Services own:

✓ workflows

✓ approvals

✓ notifications

✓ policy evaluation

✓ QR generation

✓ movement coordination

Service Rules

Services may call:

repositories

other services

utilities

Services must not:

✗ contain UI logic

✗ contain React code

Step 5 — Route

Route should be extremely small.

Location:

src/app/api/

Example:

src/app/api/v1/leaves/route.ts
Route Template
export async function POST(
  request: Request
) {
  try {
    const currentUser =
      await requireAuth();

    const body =
      await request.json();

    const dto =
      createLeaveSchema.parse(body);

    const result =
      await createLeave(
        dto,
        currentUser
      );

    return created(result);
  } catch (error) {
    return handleApiError(error);
  }
}
Route Rules

Routes:

✓ authenticate

✓ authorize

✓ validate

✓ call services

✓ map responses

Routes must not:

✗ query database

✗ implement workflows

✗ send notifications

Step 6 — UI

UI consumes APIs.

UI does not implement business rules.

Business rules belong in services.

Step 7 — Tests

After implementation:

Test:

Happy Path

Validation Errors

Authorization Errors

Business Rule Failures

Edge Cases
Feature Example
Create Leave Request

Implementation order:

1 DTO

create-leave.dto.ts

↓

2 Repository

leave.repository.ts

↓

3 Service

create-leave.service.ts

↓

4 Route

POST /api/v1/leaves

↓

5 UI

Leave Form

↓

6 Tests
Repository Design Rules

Prefer:

leaveRepository.create()

leaveRepository.findById()

leaveRepository.updateStatus()

Avoid:

leaveRepository.doEverything()

Repositories should be explicit.

Service Design Rules

Prefer:

createLeave()

approveLeave()

rejectLeave()

extendLeave()

Avoid:

leaveService.handleLeave()

Services should represent business actions.

Transaction Rules

Use transactions when multiple operations must succeed together.

Examples:

Create Leave

Create Approvals

Create Audit Record

or

Approve Leave

Update Status

Generate QR

Create Notification Log

These operations should be atomic.

Notification Rules

Notifications are side effects.

Never send notifications directly from routes.

Notifications should be triggered by services.

Audit Rules

Any significant business action should create an audit record.

Examples:

Leave Created

Leave Approved

Leave Rejected

Extension Created

Extension Approved

Manual Override
Feature Completion Checklist

Before marking a feature complete:

✓ DTO exists

✓ Validation exists

✓ Repository exists

✓ Service exists

✓ Route exists

✓ Audit logging handled

✓ Notifications handled

✓ Error handling handled

✓ Authorization handled

✓ Architecture preserved

Final Principle

Build features from the inside out:

Domain
→ DTO
→ Repository
→ Service
→ Route
→ UI

Never build from the outside in.

Business rules should drive implementation.

Not screens.


After this, your documentation set is essentially complete enough that a good AI agent can generate code that closely follows your architecture instead of producing generic CRUD code. The next practical step would be creating repository and service templates (boilerplates) that Copilot can copy when generating new features.