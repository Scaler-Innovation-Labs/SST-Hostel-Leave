<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SST Hostel Leave System

## Agent Operating Manual

This document is the authoritative engineering constitution for this repository.

All contributors, AI coding agents, Copilot, Cursor, Claude Code, Aider, OpenCode, and future automation tools must follow these rules.

If generated code conflicts with this document:

**The generated code is wrong.**

---

# Mission

Build a production-grade Hostel Leave & Movement Management Platform.

The system must prioritize:

1. Correctness
2. Auditability
3. Maintainability
4. Extensibility
5. Architectural Consistency

Never optimize for short-term convenience.

---

# Technology Stack

* Next.js App Router
* TypeScript
* Drizzle ORM
* PostgreSQL
* Tailwind CSS
* shadcn/ui
* Clerk Authentication

---

# Architecture Philosophy

The project follows:

```text
Route
→ DTO Validation
→ Service
→ Repository
→ Database
```

This flow is mandatory.

Never bypass architectural layers.

Forbidden:

```text
Route → Database
Route → Drizzle
Route → Repository
Repository → Service
Service → UI
```

---

# Project Structure

```text
src/
├── app/
├── components/
├── constants/
├── db/
│   ├── repositories/
│   └── schema/
├── dto/
├── features/
├── hooks/
├── lib/
├── providers/
├── services/
├── types/
└── utils/
```

Follow existing structure.

Do not introduce new top-level folders without strong justification.

---

# Domain Model

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

Each domain owns:

* schema
* repositories
* services
* business rules

Avoid cross-domain coupling.

---

# Critical Business Rules

## Leave Approval Is Not Movement

Leave:

```text
Permission
```

Movement:

```text
Reality
```

These systems must remain independent.

---

## Leave Extensions Are Not New Leaves

Always use:

```text
leave_extensions
```

Never create a new leave request when extending an existing leave.

---

## Workflows Are Configuration Driven

Always read workflow configuration from:

```text
workflow_definitions
workflow_steps
```

Never hardcode:

```text
Parent → Warden
POC → Warden
Admin → Warden
```

Approval chains must come from configuration.

---

## Dynamic Forms

Forms are driven by:

```text
leave_types.form_schema
```

and

```text
leave_requests.submitted_form
```

Never create database columns for individual leave form fields.

---

## Parent Auth & Dashboards

Parents are authenticated users through a dedicated OTP-based login flow.

Parents have access to:
* Web dashboard (approvals, history, stats)
* SMS-based approval (via inbound SMS parsing)
* Email-based approval (via tokenized links with OTP verification)

Parent auth infrastructure:
* OTP is sent via SMS/Email, verified against a session record
* A signed JWT cookie is issued for the parent web session (7-day expiry)
* No Clerk or social auth — parent auth is self-contained in `services/auth/parent-auth.service.ts`

Parent approval sources are tracked via the `LEAVE_APPROVAL_SOURCE` constant:
* `SMS`, `EMAIL`, `PORTAL` — each records how the parent approved/rejected

Do not introduce additional parent authentication mechanisms without strong justification.

---

## QR Rules

QR represents authorization.

QR does not represent:

* movement history
* leave history
* workflow history

QR payload should contain:

```text
token
identifier
```

only.

---

## Movement Rules

Movement history comes from:

```text
movement_events
```

Every movement transition creates a movement event.

Never create alternative movement history systems.

---

# Layer Responsibilities

## Routes

Allowed:

* authentication
* authorization
* validation
* service invocation
* response mapping

Forbidden:

* business logic
* workflows
* database queries
* notifications

---

## DTOs

DTOs define contracts.

Use:

* Zod schemas
* inferred types

Every externally supplied payload must be validated.

---

## Services

Services own:

* workflows
* approvals
* notifications
* policy evaluation
* QR generation
* movement coordination

Services orchestrate repositories.

---

## Repositories

Repositories own:

* select
* insert
* update
* delete

Repositories must remain thin.

Forbidden:

* workflows
* notifications
* approvals
* QR generation

---

## Schema

Schema files define persistence structure only.

Do not place business logic inside schema definitions.

---

# Naming Conventions

## Folders

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

```text
PascalCase
```

Examples:

```text
DashboardCard.tsx
ProfileMenu.tsx
```

---

## Hooks

```text
camelCase
```

Examples:

```ts
useLeave()
useDashboard()
```

---

## Variables

```text
camelCase
```

---

## Types

```text
PascalCase
```

---

## Constants

```text
SCREAMING_SNAKE_CASE
```

---

## Database

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
import { leaveRepository } from "@/db/repositories/leave";
```

Never use:

```text
../../../
```

Avoid circular dependencies.

---

# TypeScript Standards

Always:

* use strict typing
* use type imports
* use explicit return types for exported functions
* prefer inference when obvious

Never use:

```ts
any
```

Use:

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

Use domain errors:

```text
NotFoundError
ValidationError
ConflictError
AuthorizationError
AuthenticationError
```

---

# API Standards

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

All APIs must use standardized response helpers.

---

# Refactoring Rules

Before creating:

* component
* service
* repository
* utility
* DTO

Search for existing implementation.

Prefer extension over duplication.

---

# Code Generation Rules

Before generating code:

1. Identify domain ownership
2. Identify architectural layer
3. Search for existing implementation
4. Reuse existing patterns
5. Follow naming conventions
6. Respect domain boundaries

---

# Code Review Questions

Before finalizing any change:

* Does it belong in this layer?
* Does it belong in this domain?
* Is duplication introduced?
* Is architecture preserved?
* Is naming consistent?
* Is the implementation maintainable?
* Is the implementation extensible?

If any answer is "No", revise the implementation.

---

# Definition Of Good Code

Good code is:

* explicit
* predictable
* maintainable
* testable
* extensible

Favor:

* clarity over cleverness
* consistency over novelty
* architecture over convenience

Generate code that another engineer can confidently maintain six months from now.
