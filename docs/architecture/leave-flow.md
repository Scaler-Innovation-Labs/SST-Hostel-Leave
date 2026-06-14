# SST Hostel Leave System — Leave Flow

# Purpose

This document defines the complete leave lifecycle.

This is the authoritative reference for:

* repositories
* services
* DTOs
* APIs
* workflows
* notifications
* QR generation
* movement integration

If implementation differs from this document:

**Implementation is wrong.**

---

# Leave Lifecycle Overview

```text
DRAFT (optional)
        ↓
PENDING
        ↓
IN_APPROVAL
        ↓
APPROVED
        ↓
QR_GENERATED
        ↓
CHECKED_OUT
        ↓
OUTSIDE_HOSTEL
        ↓
RETURNED
        ↓
COMPLETED
```

Alternative paths:

```text
PENDING
   ↓
REJECTED
```

```text
PENDING
   ↓
CANCELLED
```

```text
APPROVED
   ↓
EXPIRED
```

---

# Stage 1 — Create Leave Request

Student submits leave request.

Request contains:

```text
leave type
reason
start date
end date
dynamic form data
```

System actions:

```text
Validate DTO
Validate leave type
Evaluate policies
Build approval snapshot
Create leave request
Create approval records
Create audit log
Send notifications
```

Result:

```text
leave_request.status = PENDING
```

---

# Stage 2 — Approval Chain Creation

Workflow is loaded from:

```text
workflow_definitions
workflow_steps
```

Example:

```text
HOME_PASS

1 Parent
2 Warden
```

Example:

```text
MEDICAL

1 Parent
2 POC
3 Warden
```

The workflow is frozen into:

```text
leave_requests.approval_snapshot
```

This guarantees historical accuracy.

---

# Stage 3 — Approval Processing

Approvers act sequentially.

Each action creates:

```text
leave_approvals
```

record.

Example:

```text
Parent Approves
```

creates:

```text
decision = APPROVED
approval_source = SMS
```

---

# Approval Sources

Supported:

```text
WEB
SMS
MANUAL
SYSTEM
```

Future sources may be added.

---

# Approval Outcomes

## Approved

When all required approvals succeed:

```text
leave_request.status = APPROVED
```

System actions:

```text
Create audit log
Send notifications
Generate QR pass
```

---

## Rejected

Any required approver may reject.

Result:

```text
leave_request.status = REJECTED
```

System actions:

```text
Create audit log
Send notifications
Close workflow
```

No QR generation occurs.

---

# Stage 4 — QR Generation

Approved hostel leaves generate:

```text
qr_pass
```

QR contains:

```text
token
identifier
```

Only.

QR never contains:

```text
student data
leave data
workflow data
```

Server remains source of truth.

---

# Stage 5 — Exit Hostel

Student scans QR during exit.

System validates:

```text
QR exists
QR active
Leave approved
Leave not expired
```

If valid:

```text
movement_event
```

created:

```text
EXIT_HOSTEL
```

State transition:

```text
IN_HOSTEL
        ↓
CHECKED_OUT
```

QR status:

```text
EXIT_SCANNED
```

---

# Stage 6 — Outside Hostel

After successful checkout:

Student is considered:

```text
OUTSIDE_HOSTEL
```

Movement state becomes:

```text
OUTSIDE_HOSTEL
```

Student may:

```text
Stay on leave
Return
Request extension
```

---

# Stage 7 — Leave Extension

Extension is NOT a new leave.

Critical rule:

Never create:

```text
new leave_request
```

for extension.

Use:

```text
leave_extensions
```

instead.

---

# Extension Creation

Student submits:

```text
new return date
reason
extension form data
```

System actions:

```text
Validate extension eligibility
Evaluate policies
Check extension limits
Build approval snapshot
Create extension
Create approvals
Create audit log
```

Result:

```text
leave_extension.status = PENDING
```

---

# Extension Approval

Uses same approval engine:

```text
leave_approvals
```

Parent approvals work exactly the same.

Possible outcomes:

```text
APPROVED
REJECTED
```

---

# Approved Extension

System updates:

```text
leave_request.expected_return_at
```

New deadline becomes active.

Student remains:

```text
OUTSIDE_HOSTEL
```

No new QR generated.

No new checkout occurs.

---

# Rejected Extension

Leave remains unchanged.

Original return deadline remains active.

---

# Stage 8 — Return To Hostel

Student returns.

QR is scanned.

System validates:

```text
QR valid
Leave active
Student checked out
```

Movement event created:

```text
ENTER_HOSTEL
```

State transition:

```text
OUTSIDE_HOSTEL
        ↓
RETURNED
```

QR status:

```text
RETURN_SCANNED
```

---

# Stage 9 — Completion

After successful return:

Leave becomes:

```text
COMPLETED
```

System actions:

```text
Close QR pass
Create audit log
Send notifications
```

Final state:

```text
leave_request.status = COMPLETED
```

---

# Overdue Flow

Student fails to return before:

```text
expected_return_at
```

System job detects violation.

Creates:

```text
movement_event
```

```text
AUTO_OVERDUE
```

State transition:

```text
OUTSIDE_HOSTEL
        ↓
OVERDUE
```

System actions:

```text
Audit log
Notification
Escalation
```

---

# Cancellation Flow

Student may cancel before approval.

Allowed:

```text
PENDING
```

Result:

```text
CANCELLED
```

System actions:

```text
Close approvals
Audit log
Notifications
```

---

# Expiration Flow

Leave expires when:

```text
approved leave
not used
past validity period
```

Result:

```text
EXPIRED
```

QR becomes invalid.

No movement allowed.

---

# Notification Triggers

Notifications should occur for:

```text
Leave Submitted
Approval Requested
Leave Approved
Leave Rejected
Extension Submitted
Extension Approved
Extension Rejected
Overdue
Return Completed
```

All outbound communication creates:

```text
notification_logs
```

records.

---

# Audit Triggers

Audit records should be created for:

```text
Leave Creation
Leave Approval
Leave Rejection
Leave Cancellation
Extension Creation
Extension Approval
Extension Rejection
QR Generation
QR Invalidation
Manual Override
Overdue Detection
Return Completion
```

---

# Service Ownership

Responsible services:

```text
create-leave.service.ts

approve-leave.service.ts

reject-leave.service.ts

cancel-leave.service.ts

extend-leave.service.ts

approve-extension.service.ts

reject-extension.service.ts

generate-qr.service.ts

complete-leave.service.ts

mark-overdue.service.ts
```

Each service should perform one business operation only.

---

# Final Rule

Leave lifecycle and movement lifecycle must remain independent.

Leave grants permission.

Movement records reality.

The system must preserve both truths simultaneously.
