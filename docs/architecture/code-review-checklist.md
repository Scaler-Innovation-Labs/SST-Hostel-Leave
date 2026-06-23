# SST Hostel Leave System — Code Review Checklist

# Purpose

This document defines the review standards for the project.

Every pull request, generated code block, refactor, and feature implementation should be evaluated against this checklist.

The goal is to prevent:

* architecture drift
* duplication
* hidden technical debt
* poor abstractions
* inconsistent implementations

Code should be reviewed for long-term maintainability, not just correctness.

---

# Review Philosophy

Passing tests is not enough.

Working code is not enough.

The review process should answer:

```text
Will this still be understandable
and maintainable in 6 months?
```

If the answer is no:

Refactor before merging.

---

# Layer Ownership Checklist

## Routes

Verify:

* Route only handles HTTP concerns
* Authentication is enforced
* Authorization is enforced
* DTO validation exists
* Service is called

Reject if route contains:

* workflow logic
* approval logic
* policy evaluation
* database queries
* notification logic

---

## DTOs

Verify:

* Zod schema exists
* Type is inferred from schema
* Validation rules are correct
* Contract is explicit

Reject if:

* DTO uses any
* Validation is missing
* Request body is trusted directly

---

## Services

Verify:

* Service owns business workflow
* Service orchestrates dependencies
* Service is focused on one use case

Reject if:

* Service contains UI logic
* Service performs direct SQL
* Service becomes a god-object

---

## Repositories

Verify:

* Repository only performs persistence

Reject if repository contains:

* approval logic
* notification logic
* QR generation
* policy evaluation
* workflow decisions

Repositories should remain thin.

---

## Schema

Verify:

* Schema only defines persistence structure

Reject if:

* business logic appears in schema
* workflow behavior appears in schema

---

# Architecture Checklist

## Ownership

Ask:

```text
Does this code belong here?
```

Examples:

Bad:

```text
Movement logic inside leave repository
```

Bad:

```text
Notification logic inside route
```

Good:

```text
Notification service owns notifications
```

---

## Layering

Required flow:

```text
Route
→ DTO
→ Service
→ Repository
→ Database
```

Reject if any layer is skipped.

Examples:

Bad:

```text
Route → Repository
```

Bad:

```text
Route → Database
```

---

## Domain Boundaries

Verify:

* Domain ownership is respected
* Cross-domain communication is intentional

Reject if:

* logic leaks across domains
* unrelated domains become coupled

---

# Naming Checklist

Verify:

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
approve-leave.service.ts

leave.repository.ts

create-leave.dto.ts
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

## Types

```text
PascalCase
```

Examples:

```text
LeaveRequest
CreateLeaveDto
```

---

## Variables

```text
camelCase
```

Examples:

```text
leaveRequest
studentId
```

---

## Constants

```text
SCREAMING_SNAKE_CASE
```

Examples:

```text
LEAVE_STATUS

ROLE_CODES

MOVEMENT_STATES
```

---

# Duplication Checklist

Before approving:

Search for:

* existing component
* existing service
* existing repository
* existing utility
* existing DTO

Reject if duplicate functionality is introduced.

Prefer reuse.

---

# Error Handling Checklist

Verify:

* Domain errors are used
* Error messages are meaningful
* Failure states are handled

Reject:

```ts
throw new Error(...)
```

Prefer:

```ts
NotFoundError

ValidationError

ConflictError

AuthorizationError
```

---

# TypeScript Checklist

Verify:

* No any
* Proper return types
* Proper type imports
* Proper null handling

Reject:

```ts
const data: any
```

Prefer:

```ts
unknown
```

or explicit types.

---

# Database Checklist

Verify:

* Query belongs in repository
* Query is reusable
* Query is efficient
* Query is scoped correctly

Reject:

```text
Database access from services
```

Reject:

```text
Database access from routes
```

---

# Security Checklist

Verify:

* Authentication enforced
* Authorization enforced
* User ownership validated
* Sensitive operations audited

Reject:

* trusting client input
* trusting role claims directly
* missing authorization checks

---

# Leave Domain Checklist

Verify:

* Workflow loaded from configuration
* Approval snapshot preserved
* Policy evaluation executed
* Audit records created
* Notifications triggered

Reject:

```text
Hardcoded approval chains
```

Reject:

```text
Parent → Warden hardcoded
```

---

# Extension Checklist

Verify:

* Extension uses leave_extensions

Reject:

```text
New leave request for extension
```

This is always incorrect.

---

# Movement Checklist

Verify:

* Movement creates movement event
* State transition recorded
* Audit created when required

Reject:

```text
Directly updating state without movement event
```

---

# QR Checklist

Verify:

* QR contains token only
* QR validated server-side

Reject:

```text
Student data embedded in QR
```

Reject:

```text
Leave data embedded in QR
```

---

# Notification Checklist

Verify:

* Notification logged
* Failure states handled

Reject:

```text
Sending notification without log record
```

---

# Refactoring Checklist

Refactoring must:

* preserve behavior
* reduce complexity
* improve maintainability
* improve architecture

Refactoring must not:

* silently change business rules
* alter workflows unintentionally

---

# AI Generated Code Checklist

Before accepting AI-generated code:

Ask:

```text
Does this follow project architecture?

Does this follow naming rules?

Does this duplicate existing functionality?

Does this belong in this layer?

Does this violate domain ownership?
```

Never merge AI-generated code without review.

---

# Merge Checklist

Before merge:

✓ Architecture respected

✓ Layer ownership respected

✓ Naming conventions respected

✓ DTO validation present

✓ Authorization present

✓ No duplication introduced

✓ Error handling present

✓ Audit requirements satisfied

✓ Notifications logged

✓ Domain rules preserved

✓ Code remains maintainable

If any item fails:

Do not merge.

Refactor first.

---

# Final Principle

Code should be:

* predictable
* explicit
* maintainable
* testable
* extensible

Favor clarity over cleverness.

Favor consistency over novelty.

Favor architecture over convenience.
