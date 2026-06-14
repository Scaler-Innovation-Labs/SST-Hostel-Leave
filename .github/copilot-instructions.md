# SST Hostel Leave System - Copilot Instructions

## Project Context

You are working on SST Hostel Leave System.

This is a production-grade system for:

* Hostel Leave Management
* Leave Extensions
* Approval Workflows
* Parent Approvals
* QR-Based Movement Tracking
* Notifications
* Audit Trails

Future expansion:

* College OD Workflows
* Attendance Systems
* Multi-Campus Deployments

Optimize for maintainability and scalability.

---

# Think Before Coding

Before writing code:

1. Identify the domain
2. Identify the architectural layer
3. Search for existing implementation
4. Reuse before creating new code
5. Follow existing patterns

Do not introduce new patterns without strong justification.

---

# Architecture

Request flow:

```text
Route
→ DTO Validation
→ Service
→ Repository
→ Database
```

Never bypass layers.

Forbidden:

```text
Route → Repository
Route → Database
Service → UI
Repository → Service
```

---

# Layer Responsibilities

## Routes

Responsible for:

* Authentication
* Authorization
* DTO Validation
* Service Invocation
* Response Mapping

Must not contain:

* Business Logic
* Workflow Logic
* Database Queries

---

## DTOs

Location:

```text
src/dto
```

Use:

* Zod schemas
* inferred TypeScript types

DTOs are the source of truth for validation.

---

## Services

Location:

```text
src/services
```

Responsible for:

* Workflow execution
* Approval processing
* QR generation
* Notification triggering
* Policy enforcement

Services orchestrate repositories.

---

## Repositories

Location:

```text
src/db/repositories
```

Responsible for:

* Select
* Insert
* Update
* Delete

Repositories contain persistence logic only.

Never place business logic in repositories.

---

# Domain Ownership

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

Keep domain boundaries clear.

Avoid cross-domain coupling.

---

# Critical Business Rules

## Leave Approval ≠ Movement

Leave represents permission.

Movement represents reality.

Keep both systems separate.

---

## Extensions Are Not New Leaves

Always use:

```text
leave_extensions
```

Never create a new leave request for an extension.

---

## Workflows Are Configurable

Always load workflow configuration from:

```text
leave_type_approval_steps
```

Never hardcode approval chains.

---

## Dynamic Forms

Forms are configuration-driven.

Use:

```text
leave_types.form_schema

leave_requests.submitted_form
```

Never hardcode form fields into database columns.

---

## Parents Are Not Users

Parents approve through:

* SMS
* Email

Do not build parent authentication unless explicitly required.

---

## QR Rules

QR represents authorization.

QR does not represent movement.

QR does not contain business data.

Store only:

* token
* identifier

Fetch authoritative data from the server.

---

## Movement Rules

Movement history comes from:

```text
movement_events
```

Every state transition creates a movement event.

Never create alternative movement history systems.

---

# Naming Conventions

Folders:

```text
kebab-case
```

Files:

```text
kebab-case
```

Examples:

```text
create-leave.dto.ts

approve-leave.service.ts

leave.repository.ts
```

Components:

```text
PascalCase
```

Examples:

```text
DashboardCard.tsx

ProfileMenu.tsx
```

Hooks:

```text
camelCase
```

Examples:

```ts
useLeave()

useDashboard()
```

Types:

```text
PascalCase
```

Variables:

```text
camelCase
```

Constants:

```text
SCREAMING_SNAKE_CASE
```

Database:

```text
snake_case
```

---

# Import Rules

Always use:

```ts
@/
```

Example:

```ts
import { leaveRepository }
from "@/db/repositories/leave";
```

Never use:

```ts
../../../
```

Avoid circular dependencies.

---

# TypeScript Rules

Always:

* use strict typing
* use type imports
* use explicit return types for exported functions

Never use:

```ts
any
```

Prefer:

```ts
unknown
```

or proper types.

---

# Error Handling

Never throw:

```ts
new Error(...)
```

Use:

```text
NotFoundError

ValidationError

ConflictError

AuthorizationError

AuthenticationError
```

---

# API Responses

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

Use standardized response helpers.

---

# Refactoring Rules

Before creating:

* component
* service
* repository
* utility
* DTO

Search for existing implementation.

Prefer reuse.

Avoid duplication.

Refactors should:

* preserve behavior
* improve maintainability
* improve architecture
* reduce complexity

---

# Code Quality

Generate code that is:

* explicit
* predictable
* maintainable
* testable
* extensible

Favor consistency over novelty.

Favor architecture over convenience.

Generate code that another engineer can understand six months from now.
