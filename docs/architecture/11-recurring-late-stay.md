# 11 — Late-Stay & Recurring Authorization Analysis

**Purpose:** Comprehensive architectural investigation of the late-stay workflow, occurrence claiming, and assessment of recurring authorization features.  
**Audience:** System architects, product managers, and backend engineers.  
**Status:** **PARTIALLY IMPLEMENTED** (Verified from repository inspection)

---

## 1. Executive Implementation Summary

A critical distinction exists between generic recurring authorization requirements and the actual repository implementation:

* **What IS Implemented (`IMPLEMENTED`)**:
  * A dedicated leave type code **`LATE_STAY_COLLEGE`** seeded in `src/db/seed/leave-types.seed.ts`.
  * Dedicated workflow code **`LATE_STAY_COLLEGE`** requiring `POC_APPROVAL` prior to residential warden review.
  * Specialized student UI notices (`setShowPocNotice(isLateStay)` in `src/app/(dashboard)/student/leaves/new/page.tsx`).
  * Specialized Slack alerts sent to mentors (`leave_submitted_slack_late_stay_poc`).
  * Distinct rejection notification templates (`leave_rejected_email_late_stay_poc`, `leave_rejected_email_late_stay_admin`).
* **What is NOT Implemented (`NOT IMPLEMENTED`)**:
  * There is **no dedicated recurring authorization table** (e.g. no `recurring_late_stays` or `late_stay_authorizations`).
  * There is **no occurrence-claim subsystem** (e.g. claiming a pre-approved slot for tonight without creating a leave).
  * There is **no authorization version supersession** or balance-tracking mechanism.

### Architectural Reality
In the existing codebase, **every late stay is treated as an individual, discrete `leave_requests` record** parameterized with `leave_type.code = 'LATE_STAY_COLLEGE'`.

---

## 2. Implemented `LATE_STAY_COLLEGE` Workflow Trace

When a student needs to work late in a college lab, library, or project room:

```mermaid
sequenceDiagram
    participant Student as Student Portal
    participant Route as POST /api/v1/leaves
    participant Svc as createLeave()
    participant Workflow as workflowEngine
    participant DB as PostgreSQL
    participant Outbox as outboxService

    Student->>Route: Submit Leave (leaveTypeId = LATE_STAY_COLLEGE, pocId = mentorUserId)
    Route->>Svc: createLeave()
    
    Svc->>DB: Validate POC exists & user is student
    Svc->>Workflow: Resolve workflow 'LATE_STAY_COLLEGE'
    Note over Workflow: Steps: 1. POC_APPROVAL (Order 1)<br/>2. WARDEN_APPROVAL (Order 2)

    Svc->>DB: INSERT leave_requests (status: PENDING, currentStepKey: 'POC_APPROVAL')
    Svc->>DB: INSERT leave_approvals (approver_user_id: pocId for Step 1)
    Svc->>Outbox: publish(LEAVE_CREATED)
    Svc->>Outbox: publish(LEAVE_POC_REVIEW_REQUIRED / Slack alert to mentor)

    Note over DB,Outbox: Step 1: POC approves via dashboard
    Note over DB,Outbox: Step 2: Warden approves via dashboard
    Note over DB,Outbox: Final: QR Gate Pass generated for late gate return
```

---

## 3. Comparison: Implemented Discrete Flow vs. Proposed Recurring Claim Flow

| Capability | Current Codebase (`LATE_STAY_COLLEGE`) | Proposed Recurring Claim Model |
| :--- | :--- | :--- |
| **Submission Model** | One leave request per late-stay event. | Semester-long standing permission approved once by Dean/HOD. |
| **Claiming Mechanism** | Full leave form submission with reason and dates. | One-click daily occurrence check-in via mobile app. |
| **Approval Overhead** | POC and Warden must approve each late stay individually. | Pre-approved; student claims daily token up to weekly quota. |
| **Database Entity** | `leave_requests` table with status `PENDING`. | Dedicated `recurring_authorizations` and `occurrence_claims` tables. |
| **Gate Enforcement** | Scannable QR generated per approved request. | Daily dynamic QR linked to standing authorization. |

---

## 4. Recommended Architectural Blueprint for Full Recurring System

If SST requires semester-long recurring late stays (e.g. for robotics lab teams or competition prep), the following architecture should be implemented to avoid polluting `leave_requests`:

```mermaid
erDiagram
    recurring_authorizations ||--o{ recurring_occurrences : "claimed"
    students ||--o{ recurring_authorizations : "holds"
    users ||--o{ recurring_authorizations : "approved by"
    recurring_occurrences ||--o| qr_passes : "generates"

    recurring_authorizations {
        uuid id PK
        uuid student_id FK
        text reason
        integer allowed_days_mask
        time latest_curfew
        date valid_from
        date valid_to
        text status
        integer max_weekly_claims
    }

    recurring_occurrences {
        uuid id PK
        uuid authorization_id FK
        date claim_date
        timestamp claimed_at
        text status
    }
```

### Invariants for Future Implementation
1. **Uniqueness**: Unique constraint on `(authorization_id, claim_date)` to ensure idempotency.
2. **Quota Checks**: Atomic check of claims within the calendar week against `max_weekly_claims`.
3. **Leave Conflict Guard**: Claiming an occurrence must be mutually exclusive with an active overnight leave.
