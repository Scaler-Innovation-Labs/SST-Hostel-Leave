# SST Hostel Leave System — Movement Flow

# Purpose

This document defines the movement tracking lifecycle.

Movement tracking is independent from leave approval.

This document governs:

* QR scanning
* Hostel exits
* Hostel entries
* Movement state transitions
* Overdue detection
* Manual overrides
* Security operations

If implementation differs from this document:

**Implementation is wrong.**

---

# Core Principle

## Leave Permission ≠ Physical Movement

Leave represents:

```text
Permission
```

Movement represents:

```text
Reality
```

Examples:

Student may have:

```text
APPROVED LEAVE
+
Still Inside Hostel
```

or

```text
EXPIRED LEAVE
+
Still Outside Hostel
```

Both situations are valid.

Never derive movement solely from leave status.

---

# Source Of Truth

Movement history is stored in:

```text
movement_events
```

Every movement-related action creates a movement event.

Movement events are immutable.

Never update historical movement events.

Create new events instead.

---

# Movement States

Valid states come from:

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

Always reference configured states.

---

# Student Current State

Current student location is stored in:

```text
students.current_location_state
```

This is a snapshot.

Historical truth comes from:

```text
movement_events
```

---

# Movement Event Types

Examples:

```text
EXIT_HOSTEL
ENTER_HOSTEL

AUTO_OVERDUE

MANUAL_RETURN

MANUAL_CHECKOUT

QR_INVALID

QR_EXPIRED

SECURITY_OVERRIDE
```

Additional event types may be introduced.

Do not hardcode assumptions around event lists.

---

# QR-Based Exit Flow

## Preconditions

Student must have:

```text
Approved Leave
Valid QR Pass
```

---

# Step 1

Student presents QR.

Security scans QR.

---

# Step 2

System validates:

```text
QR Exists

QR Active

QR Not Expired

Leave Approved

Leave Not Cancelled

Leave Not Completed
```

---

# Step 3

Create scan log.

```text
qr_scan_logs
```

Result:

```text
SUCCESS
```

or

```text
FAILURE
```

---

# Step 4

Create movement event.

```text
EXIT_HOSTEL
```

State transition:

```text
IN_HOSTEL
      ↓
CHECKED_OUT
```

---

# Step 5

Update current state.

```text
students.current_location_state
```

becomes:

```text
CHECKED_OUT
```

---

# Step 6

Update QR status.

```text
GENERATED
       ↓
EXIT_SCANNED
```

---

# Exit Movement Event Example

```text
event_type:
EXIT_HOSTEL

from_state:
IN_HOSTEL

to_state:
CHECKED_OUT
```

---

# Outside Hostel Transition

After checkout:

Student is considered:

```text
OUTSIDE_HOSTEL
```

Movement event:

```text
CHECKED_OUT
      ↓
OUTSIDE_HOSTEL
```

may be immediate or system-driven depending on implementation.

---

# QR-Based Return Flow

## Preconditions

Student:

```text
Checked Out
```

and

```text
Leave Active
```

or

```text
Leave Overdue
```

---

# Step 1

Student arrives at hostel.

---

# Step 2

Security scans QR.

---

# Step 3

Validate:

```text
QR Exists

QR Previously Checked Out

Student Matches QR
```

---

# Step 4

Create scan log.

---

# Step 5

Create movement event.

```text
ENTER_HOSTEL
```

State transition:

```text
OUTSIDE_HOSTEL
          ↓
RETURNED
```

---

# Step 6

Update student state.

```text
RETURNED
```

---

# Step 7

Close QR lifecycle.

```text
RETURN_SCANNED
        ↓
CLOSED
```

---

# Return Event Example

```text
event_type:
ENTER_HOSTEL

from_state:
OUTSIDE_HOSTEL

to_state:
RETURNED
```

---

# Overdue Detection

## Purpose

Detect students who have not returned within approved leave duration.

---

# Trigger

System job runs periodically.

Example:

```text
Every 15 minutes
```

or

```text
Every hour
```

---

# Detection Rule

Student is overdue if:

```text
Current Time
>
Expected Return Time
```

AND

```text
Current State
!= RETURNED
```

---

# System Action

Create movement event.

```text
AUTO_OVERDUE
```

State transition:

```text
OUTSIDE_HOSTEL
          ↓
OVERDUE
```

---

# Notification Actions

Notify:

```text
Student

Admin

Warden

POC
```

depending on workflow configuration.

---

# Audit Actions

Create:

```text
audit_log
```

entry.

---

# Overdue Resolution

Student eventually returns.

Movement event:

```text
ENTER_HOSTEL
```

State transition:

```text
OVERDUE
      ↓
RETURNED
```

---

# Manual Override Flow

Sometimes security staff may need manual actions.

Examples:

```text
Lost QR

Emergency Entry

System Outage

Security Exception
```

---

# Manual Exit

Create:

```text
MANUAL_CHECKOUT
```

movement event.

Must include:

```text
recorded_by

override_reason
```

---

# Manual Return

Create:

```text
MANUAL_RETURN
```

movement event.

Must include:

```text
recorded_by

override_reason
```

---

# Security Override

Exceptional situations.

Create:

```text
SECURITY_OVERRIDE
```

movement event.

Must always create:

```text
audit_log
```

entry.

---

# Invalid QR Flow

QR validation fails.

Examples:

```text
Expired

Invalid

Already Used

Cancelled Leave

Completed Leave
```

---

# System Actions

Create:

```text
qr_scan_log
```

Result:

```text
FAILURE
```

Reason:

```text
QR_EXPIRED

QR_INVALID

LEAVE_CANCELLED
```

etc.

---

# Important Rule

Invalid QR scans:

```text
DO NOT
```

create movement events.

Only create:

```text
qr_scan_logs
```

---

# Movement Timeline Reconstruction

Student timeline must always be generated from:

```text
movement_events
```

Example:

```text
EXIT_HOSTEL

OUTSIDE_HOSTEL

AUTO_OVERDUE

ENTER_HOSTEL
```

Timeline should never rely on:

```text
students.current_location_state
```

because that only stores the latest state.

---

# QR Rules

QR is an authorization artifact.

QR is not movement history.

QR is not workflow history.

QR is not leave history.

QR only enables movement operations.

---

# Audit Triggers

Create audit records for:

```text
Manual Checkout

Manual Return

Security Override

QR Invalidation

Overdue Detection

Forced Closure
```

---

# Future Integrations

Movement architecture must support:

```text
RFID

Biometric Gates

Face Recognition

Turnstiles

Smart Hostel Entry Systems
```

without redesigning movement tables.

All future systems should generate:

```text
movement_events
```

and preserve existing movement rules.

---

# Final Rule

Movement records reality.

Leave records permission.

QR records authorization.

These three systems must remain independent but coordinated.
