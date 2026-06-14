# SST Hostel Leave System — Domain Rules

# Purpose

This document defines the business rules of the platform.

These rules represent business truth.

If code conflicts with this document:

**The code is wrong.**

Business rules always override implementation details.

---

# Core Domain Principle

## Leave Approval ≠ Physical Movement

These are separate concepts.

### Leave

Represents:

```text
Permission
```

Example:

```text
Student receives permission to leave.
```

---

### Movement

Represents:

```text
Physical movement
```

Example:

```text
Student actually exits hostel.
```

---

A student may have:

```text
Approved Leave
+
Still Inside Hostel
```

Or:

```text
Leave Expired
+
Still Outside Hostel
```

Therefore:

Never combine:

* leave lifecycle
* movement lifecycle

---

# Leave Domain

## Leave Request

A leave request represents:

```text
Request for permission
```

A leave request does NOT represent:

```text
Actual movement
```

---

## Leave Types

Leave types are configurable.

Examples:

```text
HOME_PASS
MEDICAL
NIGHT_OUT
LOCAL_OUTING
```

New leave types should be configurable without schema changes.

---

## Dynamic Forms

Leave forms are configuration-driven.

Use:

```text
leave_types.form_schema
```

and

```text
leave_requests.submitted_form
```

Never add database columns for every form field.

---

# Workflow Rules

Approval chains are configuration-driven.

Source of truth:

```text
workflow_definitions
workflow_steps
```

Never hardcode:

```text
Parent → Warden
```

or

```text
POC → Warden
```

inside services.

Always build workflows from configuration.

---

# Approval Rules

Approvals represent actions performed by approvers.

Approvers may be:

```text
Parent
User
System
```

Examples:

```text
Parent Approval
POC Approval
Admin Approval
Auto Approval
```

All approvals must be stored in:

```text
leave_approvals
```

---

# Parent Approval Rules

Parents may approve through:

```text
SMS
Email Link
Future Channels
```

Parents are NOT authenticated users.

Parents are relationship entities.

Do not create parent accounts unless explicitly required.

---

# Leave Status Rules

Valid statuses:

```text
PENDING
APPROVED
REJECTED
CANCELLED
EXPIRED
COMPLETED
```

Only valid transitions should be allowed.

Example:

```text
PENDING
→ APPROVED
```

Valid.

Example:

```text
REJECTED
→ APPROVED
```

Usually invalid.

Services must enforce state transitions.

---

# Leave Extension Rules

## Extension Is Not New Leave

Critical rule.

A leave extension must never create:

```text
new leave request
```

Reason:

The student is already outside the hostel.

Creating a new leave request breaks:

* movement tracking
* QR lifecycle
* return tracking

---

## Correct Extension Model

Use:

```text
leave_extensions
```

linked to:

```text
leave_requests
```

---

## Extension Approval Rules

Extensions may require:

```text
Parent Approval
POC Approval
Admin Approval
```

The workflow is executed through:

```text
leave_approvals
```

The same approval engine must be reused.

---

## Extension Limits

Extension eligibility comes from:

```text
leave_types.allow_extensions

leave_types.max_extension_count
```

Never hardcode extension limits.

---

# Movement Domain

## Source Of Truth

Movement history comes from:

```text
movement_events
```

Only.

---

## No Secondary History

Do not create:

```text
movement_history
student_movement_log
location_history
```

Movement events already provide complete history.

---

# Movement States

Valid states are defined in:

```text
movement_states
```

Examples:

```text
IN_HOSTEL
APPROVED_LEAVE
CHECKED_OUT
OUTSIDE_HOSTEL
RETURNED
OVERDUE
```

Never hardcode state names.

Never create state strings manually.

Always reference configured states.

---

# Movement Events

Every transition creates a movement event.

Examples:

```text
EXIT_HOSTEL
ENTER_HOSTEL
AUTO_OVERDUE
MANUAL_RETURN
```

Movement events are immutable.

Never modify historical movement records.

Create new events instead.

---

# Overdue Rules

A student becomes overdue when:

```text
current_time >
expected_return_time
```

and

```text
student has not returned
```

The system creates:

```text
AUTO_OVERDUE
```

movement event.

---

# QR Domain

## Purpose

QR passes represent:

```text
Movement Authorization
```

They do not represent movement itself.

---

## QR Payload Rules

QR codes should contain:

```text
Token
Identifier
```

Only.

Never embed:

```text
Leave Details
Student Details
Workflow Data
```

inside QR payloads.

Server remains source of truth.

---

## QR Lifecycle

Example:

```text
Generated
→ Exit Scanned
→ Return Pending
→ Return Scanned
→ Closed
```

QR lifecycle is independent from leave lifecycle.

---

## Scan Logs

Purpose:

```text
Technical audit
```

Stored in:

```text
qr_scan_logs
```

Examples:

```text
Success
Failure
Duplicate Scan
Expired Token
```

Scan logs are not movement history.

---

# Policy Domain

## Purpose

Policies define configurable business rules.

Examples:

```text
Maximum Leave Duration
Blocked Dates
Curfew Rules
Extension Limits
```

Policies are configuration.

Policies are not workflows.

---

## Policy Evaluation

Policies are evaluated:

```text
During Leave Creation
During Leave Extension
```

Results are stored in:

```text
policy_result
```

for auditability.

---

# Notification Domain

## Purpose

Track communication.

Supported channels:

```text
EMAIL
SMS
```

Future channels:

```text
PUSH
WHATSAPP
```

---

## Notification Logs

Every outbound communication must create:

```text
notification_logs
```

record.

Examples:

```text
Approval Request
Approval Success
Leave Rejection
Extension Approved
```

---

## Inbound SMS

Incoming parent replies are stored in:

```text
inbound_sms_logs
```

This is raw communication history.

Never treat inbound logs as approval records.

Approvals are stored separately.

---

# Audit Domain

## Purpose

Provide traceability.

Every important action should be auditable.

Examples:

```text
Leave Created
Leave Approved
Leave Rejected
Extension Approved
Manual Override
```

---

## Audit Logs Are Not

Audit logs are NOT:

```text
Movement History
Notification History
Workflow History
```

They are system-level records.

---

# Student Rules

Every student belongs to:

```text
Academic Group
```

An academic group represents:

```text
Department
Batch
Optional Section
```

Example:

```text
CSE
2028
A
```

Students may also have:

```text
Room Number
```

stored on the student record.

---

# Future Expansion Rules

The architecture must support future:

```text
OD Requests
Attendance Requests
Vacation Stay Requests
Multi-Campus Deployments
ERP Integrations
```

without major schema rewrites.

Avoid hardcoded hostel-only assumptions unless explicitly required.

---

# Business Rule Checklist

Before implementing any feature:

1. Does this affect leave lifecycle?
2. Does this affect movement lifecycle?
3. Does it require approvals?
4. Does it require audit logging?
5. Does it require notifications?
6. Does it require policy evaluation?
7. Is the workflow configurable?
8. Is historical data preserved?

If unsure, revisit domain ownership before coding.

The system values correctness and traceability over convenience.
