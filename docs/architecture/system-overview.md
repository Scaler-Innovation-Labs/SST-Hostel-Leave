# SST Hostel Leave System — System Overview

# Purpose

SST Hostel Leave System is a production-grade leave and movement management platform designed for hostel operations.

The system manages:

* Leave Requests
* Leave Extensions
* Approval Workflows
* Parent Approvals
* QR-Based Movement Tracking
* Notifications
* Audit Trails
* Policy Enforcement

The architecture is intentionally designed for future expansion into:

* College OD Workflows
* Attendance Systems
* Multi-Campus Deployments
* ERP Integrations
* Advanced Analytics

---

# Core Principle

## Leave Approval ≠ Physical Movement

These are separate business processes.

Example:

A student may have:

* Approved leave
* Still be inside hostel

Or:

* Leave expired
* Still outside hostel

Therefore:

Leave lifecycle and movement lifecycle are modeled independently.

---

# High-Level Domains

The system is divided into business domains.

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

Each domain owns its own:

* database schema
* repositories
* services
* business rules

Cross-domain coupling should be minimized.

---

# Architecture Layers

Every request follows:

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
Route → Database
Route → Drizzle
Route → Repository
```

---

# Domain Responsibilities

## Auth Domain

Purpose:

* Identity
* Authentication
* Authorization
* RBAC

Tables:

```text
users
roles
user_roles
```

Important:

Students and parents are not auth entities.

---

## Academics Domain

Purpose:

* Academic identity

Tables:

```text
departments
academic_groups
students
```

Academic groups represent:

```text
Department
Batch
Optional Section
```

Example:

```text
CSE - 2028 - A
```

---

## Hostel Domain

Purpose:

* Hostel configuration
* Parent relationships

Tables:

```text
hostels
parents
```

Parents are relationship entities.

Parents do not require login accounts.

---

## Leave Domain

Purpose:

* Leave workflows
* Leave approvals
* Leave extensions

Tables:

```text
leave_types
workflow_definitions
workflow_steps
leave_requests
leave_extensions
leave_approvals
leave_documents
operational_periods
```

This is the core business domain.

---

## Movement Domain

Purpose:

* Physical movement tracking

Tables:

```text
movement_states
movement_events
qr_passes
qr_scan_logs
```

Movement tracking is intentionally separate from leave approval.

---

## Policy Domain

Purpose:

* Business rule configuration

Tables:

```text
policies
```

Examples:

* Max leave days
* Curfew restrictions
* Extension limits
* Blocked periods

---

## Notification Domain

Purpose:

* Communication tracking

Tables:

```text
notification_templates
notification_logs
inbound_sms_logs
sheet_sync_logs
```

Supports:

* Email
* SMS
* Future channels

---

## Audit Domain

Purpose:

* Compliance
* Traceability
* Investigations

Tables:

```text
audit_logs
```

Audit logs are not movement history.

Audit logs are not notifications.

Audit logs track system actions.

---

# Leave Architecture

Leave requests are permission records.

They represent authorization to leave.

A leave request does not mean movement has occurred.

---

# Leave Extensions

Extensions are not new leave requests.

Reason:

The student is already outside the hostel.

Creating a new leave request would break:

* QR lifecycle
* Movement lifecycle
* Return tracking

Use:

```text
leave_extensions
```

for all extension operations.

---

# Workflow Architecture

Workflows are configuration-driven.

Use:

```text
workflow_definitions
workflow_steps
```

Never hardcode approval chains.

Bad:

```text
Parent → Warden
```

Good:

```text
Read workflow configuration
Build approval chain
Execute workflow
```

---

# Dynamic Forms

Different leave types require different fields.

Examples:

* Home Pass
* Medical Leave
* Night Out

Therefore:

```text
form_schema
submitted_form
```

exist.

Forms are configuration-driven.

Never create DB columns for every leave form field.

---

# Parent Approvals

Parents may approve via:

* SMS
* Email links

Parents are not authenticated users.

Do not build parent login systems unless explicitly required.

---

# QR Architecture

QR passes represent permission.

QR passes do not represent movement.

QR codes should only contain:

* Token
* Identifier

Business data must always be fetched from the server.

---

# Movement Architecture

Movement events are the source of truth.

Every state transition creates a movement event.

Examples:

```text
EXIT_HOSTEL
ENTER_HOSTEL
AUTO_OVERDUE
MANUAL_RETURN
```

Movement history must always be reconstructed from:

```text
movement_events
```

---

# Design Philosophy

The platform prioritizes:

* Auditability
* Correctness
* Configurability
* Maintainability
* Extensibility

Over:

* Short-term convenience
* Hardcoded workflows
* Tight coupling

The goal is predictable, scalable, production-grade software.
