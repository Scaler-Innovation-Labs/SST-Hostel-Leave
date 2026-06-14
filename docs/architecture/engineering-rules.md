# SST Hostel Leave System — Engineering Rules

# Purpose

This document defines the engineering standards for the entire codebase.

These rules are mandatory.

The goal is to ensure:

* consistency
* maintainability
* architectural integrity
* predictable code generation
* scalable development

All engineers and AI coding agents must follow these rules.

---

# Engineering Philosophy

Code is read far more often than it is written.

Optimize for:

1. Correctness
2. Readability
3. Maintainability
4. Extensibility

Never optimize for:

* cleverness
* unnecessary abstractions
* premature optimization

The best code is boring, predictable, and easy to maintain.

---

# Architecture First

Before writing code determine:

1. Which domain owns this logic?
2. Which layer owns this responsibility?
3. Does similar functionality already exist?
4. Is this introducing duplication?
5. Is this violating architecture?

If unsure, stop and evaluate ownership before implementing.

---

# Layering Rules

Every request follows:

```text
Route
→ DTO Validation
→ Service
→ Repository
→ Database
```

This flow must never be bypassed.

---

# Route Rules

Routes exist only for HTTP concerns.

Allowed:

* authentication
* authorization
* DTO validation
* service invocation
* response mapping

Forbidden:

* database queries
* workflow logic
* policy evaluation
* notification logic
* approval logic
* QR generation

Bad:

```ts
db.insert(...)
```

inside route handlers.

---

# DTO Rules

DTOs define contracts.

Location:

```text
src/dto/
```

Every DTO must:

* use Zod
* export schema
* export inferred type

Example:

```ts
export const createLeaveSchema = z.object({...});

export type CreateLeaveDto =
  z.infer<typeof createLeaveSchema>;
```

DTOs are the source of truth for request validation.

---

# Service Rules

Services contain business orchestration.

Location:

```text
src/services/
```

Services are responsible for:

* workflow execution
* approval processing
* policy enforcement
* QR generation
* notification triggering
* movement coordination

Services may call multiple repositories.

Services must not contain UI logic.

---

# Repository Rules

Repositories contain persistence logic only.

Location:

```text
src/db/repositories/
```

Allowed:

```ts
findById()
create()
update()
delete()
```

Forbidden:

* notifications
* workflows
* QR generation
* approval chains
* policy evaluation

Bad:

```ts
approveLeaveAndSendEmail()
```

Repositories should remain thin.

---

# Database Rules

Database schema exists only to define persistence models.

Location:

```text
src/db/schema/
```

Do not place:

* business logic
* workflow logic
* computed behavior

inside schema files.

---

# Domain Ownership Rules

Domains:

```text
auth
academics
hostel
leave
movement
policy
notification
audit
```

Each domain owns its own behavior.

Avoid cross-domain leakage.

Example:

Bad:

```text
movement service updates leave status directly
```

Good:

```text
movement service coordinates with leave service
```

when ownership requires it.

---

# Naming Rules

## Folders

Use:

```text
kebab-case
```

Examples:

```text
leave
movement
notification
```

---

## Files

Use:

```text
kebab-case
```

Examples:

```text
create-leave.dto.ts
approve-leave.service.ts
leave.repository.ts
```

---

## Components

Use:

```text
PascalCase
```

Examples:

```tsx
DashboardCard.tsx
LeaveTable.tsx
ProfileMenu.tsx
```

---

## Hooks

Use:

```ts
useLeave()
useDashboard()
```

Hook names must start with:

```text
use
```

---

## Variables

Use:

```ts
camelCase
```

Examples:

```ts
leaveRequest
createdAt
studentId
```

---

## Types

Use:

```ts
PascalCase
```

Examples:

```ts
LeaveRequest
CreateLeaveDto
LeaveStatus
```

---

## Constants

Use:

```ts
SCREAMING_SNAKE_CASE
```

Examples:

```ts
LEAVE_STATUS
ROLE_CODES
MOVEMENT_STATE
```

---

## Database

Use:

```text
snake_case
```

Examples:

```text
leave_requests
created_at
updated_at
```

---

# Import Rules

Always use:

```ts
@/
```

Examples:

```ts
import { leaveRepository }
from "@/db/repositories/leave";
```

Never use:

```ts
../../../
```

relative import chains.

---

# Circular Dependency Rules

Circular dependencies are forbidden.

Examples:

Bad:

```text
service → repository → service
```

Bad:

```text
feature → service → feature
```

Every dependency must flow in one direction.

---

# TypeScript Rules

Always:

* use strict typing
* use inferred types where appropriate
* use type imports
* use explicit return types for exported functions

Never:

```ts
any
```

Use:

```ts
unknown
```

or a proper type.

---

# Error Handling Rules

Never throw:

```ts
throw new Error(...)
```

Use domain errors.

Examples:

```ts
NotFoundError
ValidationError
ConflictError
AuthorizationError
AuthenticationError
```

Errors must be meaningful and actionable.

---

# API Response Rules

All API responses use standard envelopes.

Success:

```json
{
  "success": true,
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "",
    "message": ""
  }
}
```

No custom response formats.

---

# Reuse Rules

Before creating:

* component
* hook
* repository
* service
* utility

Search the codebase first.

Prefer extending existing implementations.

Avoid duplication.

---

# Refactoring Rules

Refactoring must:

* preserve behavior
* reduce complexity
* improve maintainability
* improve architecture

Refactoring must not:

* change business rules
* introduce hidden side effects

---

# AI Agent Rules

Before generating code:

1. Identify domain ownership
2. Identify architectural layer
3. Search for existing implementation
4. Follow naming conventions
5. Follow existing patterns

Prefer consistency over novelty.

Generate code that fits the existing architecture.

Do not introduce new patterns without strong justification.

---

# Code Review Checklist

Every change should answer:

* Is ownership correct?
* Is layer placement correct?
* Is duplication introduced?
* Is architecture preserved?
* Is naming consistent?
* Is the solution maintainable?
* Is the solution extensible?
* Is the implementation simple?

If any answer is "no", revisit the implementation before merging.
