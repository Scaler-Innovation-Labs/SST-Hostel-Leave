# SST Hostel Leave & Movement System — Master Architecture Reference

**Status:** Authoritative learning and architecture index  
**Last verified:** 2026-10-22  
**Repository state:** `security/dependency-hardening` at `1b6a3ad`  
**Purpose:** Provide one verified map of the system so engineers can learn the repository without guessing from individual files.

> **Documentation rule:** This document distinguishes repository facts, test evidence, and live-load evidence. If a claim is not supported by source code, tests, or an explicitly recorded verification run, it is marked **NOT VERIFIED** rather than inferred.

---

## 1. Source-of-Truth Hierarchy

When documentation and implementation disagree, use this order:

1. **Current source code** — actual runtime behavior.
2. **Database schema and migrations** — persistence constraints and historical evolution.
3. **Automated tests** — executable behavioral guarantees.
4. **Recorded live/load verification** — infrastructure and concurrency observations that cannot be proven from static code alone.
5. **Architecture documentation** — explanation and navigation aid.
6. **Historical notes / recommendations** — useful context, but not proof of current behavior.

This prevents an old architecture note from being treated as current implementation truth.

---

## 2. What This System Does

The SST Hostel Leave system manages two related but deliberately separate concerns:

- **Leave approval:** whether a student has permission to be away.
- **Physical movement:** whether the student actually exited or returned through a monitored gate.

The central invariant is:

```text
APPROVED LEAVE != PHYSICAL EXIT

Approved leave
    -> permission exists
    -> student can still be IN_HOSTEL

Guard EXIT scan
    -> physical movement recorded
    -> student becomes OUTSIDE_HOSTEL

Guard RETURN scan
    -> physical return recorded
    -> student becomes IN_HOSTEL
    -> applicable leave can become COMPLETED
```

Other core invariants:

- Leave extensions use `leave_extensions`; they are not new leave requests.
- Approval workflows are configuration-driven through workflow definitions/steps and versioned configuration.
- Parent approval is token-based and does not require a Clerk session.
- QR credentials authorize a movement action; movement history is stored separately in movement/audit records.
- Existing leaves retain the configuration context under which they were evaluated.

---

## 3. System Actors

| Actor | Main responsibility | Authentication / scope |
|---|---|---|
| `STUDENT` | Create/cancel leaves, submit documents, view QR passes | Clerk authenticated; own resources |
| `GUARD` | Preview and commit QR exit/return scans; manual movement | Clerk authenticated; gate/movement permissions |
| `POC` | Review configured approval steps | Clerk authenticated; scoped access |
| `ADMIN` | Hostel-level approval, operations, monitoring | Clerk authenticated; hostel scope |
| `SUPER_ADMIN` | Global configuration, policies, workflows, administration | Clerk authenticated; global scope |
| `PARENT` | Approve/reject through magic link | Token authenticated; no Clerk account/session |

---

## 4. Runtime Architecture

```text
Browser / Guard Scanner / Parent Link
                |
                v
        Next.js App Router
                |
       +--------+---------+
       |                  |
   API Routes          UI / Server
       |
       v
 Authentication / Authorization
       |
       v
 DTO validation / rate limits
       |
       v
      Services
       |
       v
   Repositories
       |
       v
 PostgreSQL via PgBouncer
       |
       +-------------------------+
       |                         |
       v                         v
 Business tables             Outbox events
                                  |
                                  v
                         Separate outbox worker
                                  |
                     +------------+-------------+
                     |            |             |
                    SMS          Email         Slack
```

### Current verified database path

The runtime database adapter is `src/lib/db/index.ts` using:

- `pg` / `node-postgres`
- Drizzle ORM
- bounded `pg.Pool(max: 10)`
- `idleTimeoutMillis = 30_000`
- `connectionTimeoutMillis = 10_000`

Live infrastructure verification on 2026-10-22 observed PostgreSQL 18.3 on AWS Graviton behind PgBouncer at port `6432`.

> **Important correction:** Older documentation described Neon Serverless PostgreSQL and `@neondatabase/serverless`. The current runtime implementation and live infrastructure evidence do not support treating Neon as the production database architecture.

---

## 5. Application Layer Rule

The normal backend request path is:

```text
Route
  -> authentication / authorization
  -> DTO validation
  -> service
  -> repository
  -> PostgreSQL
```

Cross-layer shortcuts are intentionally restricted by the repository's architecture rules.

### Why this matters

- **Route:** HTTP concerns.
- **DTO:** input shape and validation.
- **Service:** business rules, transactions, orchestration.
- **Repository:** persistence operations.
- **Database:** durable constraints and concurrency guarantees.

When learning a feature, follow this chain instead of reading the whole repository.

---

## 6. The Most Important End-to-End Flow: Create Leave

Primary implementation:

```text
POST /api/v1/leaves
        |
        v
create-leave.service.ts
        |
        +--> identify student
        +--> load leave type
        +--> reject past-dated start
        +--> validate submitted form
        +--> evaluate policies
        |
        v
DB transaction
        |
        +--> lock student row
        +--> reject conflicting overlap
        +--> resolve configured workflow
        +--> allocate request number from DB sequence
        +--> create leave request
        +--> freeze leave/workflow configuration context
        +--> persist policy evaluations
        +--> create approval rows
        +--> write audit record
        +--> publish outbox events
        |
        v
PENDING leave + current workflow step
```

Important verified implementation points:

- Past-dated requests are rejected using an IST start-of-day boundary.
- Request numbers are allocated atomically from a PostgreSQL-backed sequence.
- The student row is locked during the transaction for overlap/concurrency protection.
- Approval rows are created from the resolved workflow.
- Policy evaluation results are persisted.
- Notification work is represented through outbox events rather than making provider calls the core transaction boundary.

Primary code map:

- `src/app/api/v1/leaves/route.ts`
- `src/dto/leave/create-leave.dto.ts`
- `src/services/leave/create-leave.service.ts`
- `src/db/repositories/leave/leave.repository.ts`
- `src/services/policy/policy-engine.ts`
- `src/services/workflow/workflow-engine.ts`

---

## 7. Approval Workflow

The workflow is configuration-driven rather than a hardcoded sequence in the leave service.

```text
Leave created
    |
    v
currentStepKey / currentStepOrder
    |
    v
Approval row for current step
    |
    +--> approve/reject
    |
    v
advance to next configured step
    |
    +--> parent step -> tokenized parent flow
    |
    +--> final step -> APPROVED
                              |
                              v
                           QR/pass flow
```

### Critical concurrency invariant

An approval action must operate on the **current** workflow step. A future approval row existing in the database does not make that future step actionable.

This is also the semantic basis for the dashboard's actionable pending-approval count.

Primary code areas:

- `src/services/workflow/`
- `src/services/leave/approve-leave.service.ts`
- `src/db/repositories/leave/leave-approval.repository.ts`
- workflow schema/version tables

---

## 8. Parent Approval

Parent approval is deliberately different from internal authentication.

```text
Leave reaches parent step
        |
        v
Generate high-entropy token
        |
        v
Store SHA-256 token hash
        |
        v
Send tokenized link through outbox
        |
        v
Parent opens link
        |
        v
POST decision
        |
        +--> hash presented token
        +--> find matching approval
        +--> check expiry
        +--> check decision is still PENDING
        +--> verify current workflow step
        +--> atomically apply decision
        |
        v
Advance workflow / emit outbox events
```

Security properties verified in the implementation:

- token material is high entropy;
- the persisted lookup value is hashed;
- expiry is enforced;
- repeated decisions are rejected;
- concurrent same-token decisions have exactly one winner in the tested race.

### Administrative Overrides

Parent approval steps are normally resolved through the parent approval link. Authorized administrators may override a parent approval step when operationally necessary; such overrides must be explicitly authorized and auditable.

---

## 9. QR and Physical Movement

Movement is a state machine, not a side effect of approval.

```text
IN_HOSTEL
   |
   | valid EXIT scan
   v
OUTSIDE_HOSTEL
   |
   | valid RETURN scan
   v
IN_HOSTEL
```

The QR scan service validates, among other things:

- token existence/hash;
- active QR status;
- scan type;
- `validFrom`;
- exit expiry rules;
- open movement session for returns;
- pass lifecycle (`firstScanAt`, `closedAt`);
- leave status;
- return-pass restrictions.

The committed scan transaction records movement/audit information and updates student location state.

Primary implementation:

- `src/services/movement/scan-qr.service.ts`
- `src/services/movement/record-movement.service.ts`
- `src/db/repositories/movement/qr-pass.repository.ts`
- `src/db/repositories/movement/qr-scan-log.repository.ts`

---

## 10. Transactional Outbox

Notifications are separated from the business transaction.

```text
Business transaction
    |
    +--> domain mutation
    +--> outbox event
             |
             v
       outbox worker
             |
      claim with ownership/lease
             |
             v
        provider call
             |
      success / retry / failure
```

Current worker safeguards include:

- explicit claim ownership;
- stale-processing recovery;
- bounded retry budget;
- exponential backoff;
- batch processing;
- `FOR UPDATE SKIP LOCKED` style concurrency control;
- idempotency handling for event insertion.

Operational limitation: the worker is a separate execution dependency. The application is not itself a permanently running queue consumer on Vercel.

Primary code areas:

- `src/services/outbox/`
- `src/db/repositories/outbox/`
- `scripts/run-outbox-worker.ts`
- notification event handlers/provider adapters

---

## 11. Authentication, Authorization, and Resource Scope

Authentication answers:

```text
Who are you?
```

Authorization answers:

```text
Are you allowed to perform this operation on this resource?
```

The repository enforces both role checks and resource scope checks. Important security invariants include:

- inactive/deactivated users cannot continue to access protected resources;
- leave access is scoped to the appropriate student/hostel context;
- QR access is scoped to the student/pass/resource involved;
- approval actions must target the current workflow step;
- parent endpoints rely on the token rather than a Clerk session.

Primary code area:

- `src/lib/auth/`
- `src/services/auth/`
- authorization helpers and repository scope checks

---

## 12. Rate Limiting

The limiter is database-backed so counters are shared across serverless instances.

The implementation uses an atomic `INSERT ... ON CONFLICT DO UPDATE` window counter in `rate_limit_entries`.

Important configured limits include:

| Flow | Limit |
|---|---:|
| Parent approval view | 30 / 15 min |
| Parent approval decision | 10 / 15 min |
| Guard QR scan / preview | 120 / min |
| Manual movement writes | 60 / min |
| Student QR generation | 30 / min |
| Staff approval | 60 / min |
| Document uploads | 60 / hour |
| Bulk imports | 10 / hour |
| Outbox manual process | 10 / min |
| Create leave | 20 / min / student |
| Cancel leave | 30 / min / student |

For public parent endpoints, the limiter key uses a SHA-256 token hash rather than the raw bearer token.

Trade-off: every rate-limited request adds a database write. Redis/Upstash is **not currently required by the verified load tests**; it should only be introduced if DB contention becomes a measured bottleneck.

---

## 13. Database Concepts You Must Understand

The most important entities for learning are:

```text
users
  |
students ---- hostels / roles
  |
leave_requests
  |
  +---- leave_approvals
  |
  +---- leave_extensions
  |
  +---- qr_passes
  |
  +---- movement_events
  |
  +---- audit_logs
  |
  +---- outbox_events
```

Also understand the configuration/versioning side:

```text
leave_types
workflow_definitions
workflow_steps
workflow_versions
leave_type_versions
leave_configuration_contexts
policy definitions / versions / evaluations
```

Do not memorize every column initially. Understand relationships, ownership, foreign keys, unique constraints, state fields, and transaction boundaries.

---

## 14. Dashboard and Analytics Semantics

A dashboard metric is only useful if its definition matches the business meaning.

The `pendingApprovals` metric was corrected to count **actionable pending leave requests**, not every pending approval row.

The corrected semantics require:

- leave is still `PENDING`;
- approval decision is `PENDING`;
- approval is not an extension approval;
- approval `stepOrder` matches the leave's current step order;
- approval `stepKey` matches the leave's current step key;
- normal hostel scope is preserved.

Dashboard query consolidation reduced the measured staff-dashboard fan-out from **18 SQL queries/request to 11**.

Measured 100-VU improvement:

| Metric | Before | After |
|---|---:|---:|
| Burst duration | 4.941s | 3.169s |
| p50 | 2.612s | 1.672s |
| p95 | 4.662s | 2.963s |
| Errors | 0% | 0% |

---

## 15. Performance and Load-Test Evidence

These are test observations, not a blanket capacity guarantee.

### Database inspection

- PostgreSQL 18.3 on AWS Graviton.
- PgBouncer observed on `:6432`.
- PostgreSQL `max_connections = 400`.
- Baseline connections were roughly 27–32 during the verification window.
- Buffer cache hit ratio observed at 100%.
- No idle-in-transaction connections observed.

### 500-VU leave creation

- 500 concurrent VUs attempted creation.
- 200 successful creates; 3 expected overlap/business rejections.
- 297 local load-generator `pg.Pool` connection timeouts at the 10-second pool timeout.
- No unexpected 5xx responses.
- No duplicate request numbers.
- No duplicate leave records.
- No deadlocks or serialization failures.

Interpretation: correctness was strong; the test was limited by the single load-generator process and its local `pg.Pool(max=10)`. This does **not** by itself justify increasing the application pool size.

### 2,000-operation QR burst

- 2,000 scan operations completed.
- 2,000/2,000 successful.
- 0 timeouts over 10 seconds.
- p50: 2,948 ms.
- p95: 3,337 ms.
- p99: 3,458 ms.
- effective throughput: 17 scans/sec with the tested single client/socket pool.
- peak active DB connections: 10.
- no connection leaks.
- 2,000 leaves completed, 2,000 QR passes closed, 2,000 movement events generated.

**Correct claim:** the tested 2,000-operation QR burst completed successfully under the tested load-generator configuration.  
**Incorrect claim:** “the system is proven to support 2,000 concurrent production VUs.”

---

## 16. Current Verification Snapshot

As of the recorded verification on 2026-10-22:

- **Tests:** 183 test files, 1,180 tests passed, 5 skipped.
- **Production build:** Next.js 16.4.2, 91/91 routes built successfully.
- **Dependency audit:** known critical dependency findings addressed in the hardening work; this is a point-in-time audit state and must remain under continuous dependency scanning.
- **Working tree:** clean after the documented cleanup commit.
- **Request-number allocation:** PostgreSQL sequence migration applied and concurrency-tested.
- **Past-date leave validation:** implemented and tested.
- **Outbox claim/stale recovery:** implemented and tested.
- **QR replay/concurrency lifecycle:** implemented and load-tested.
- **Dashboard pending-approval semantics:** corrected and regression-tested.

---

## 17. Current Gaps / Do Not Pretend These Are Solved

### G1 — Continuous outbox execution dependency
The outbox implementation is durable and retryable, but it still depends on an external worker/scheduler being available to drain it continuously. This is an operational dependency, not a transactional correctness failure.

### G2 — Audit before/after snapshots
The audit schema contains snapshot-oriented fields, but the current audit service does not provide a complete before/after entity snapshot for every mutation. Do not claim full forensic state reconstruction from `audit_logs` alone.

### G3 — Recurring late-stay authorization
`LATE_STAY_COLLEGE` currently uses the standard leave pipeline. A full standing authorization/occurrence-claim subsystem is not verified as implemented.

### G4 — Gate offline operation
QR scanning currently depends on live application/database connectivity. Offline gate operation is not implemented as a verified feature.

### G5 — Multi-instance production capacity beyond tested scenarios
The load tests establish specific successful scenarios, not an absolute production VU limit. Further distributed load testing would be needed to make stronger capacity claims.

---

## 18. Learning Map — What You Actually Need to Understand

### Tier 1 — Must understand deeply

1. Create Leave flow.
2. Leave state machine.
3. Approval workflow/current-step enforcement.
4. Parent token approval.
5. QR generation and scan lifecycle.
6. Movement state machine.
7. PostgreSQL transactions and row locking.
8. Repository/service/API layer separation.
9. Authentication + authorization + resource scoping.
10. Transactional outbox and worker leases.
11. Rate limiting.
12. Dashboard query consolidation and metric semantics.

### Tier 2 — Understand the purpose and trace one example

- policy engine;
- leave type configuration/versioning;
- documents and object storage;
- cron/maintenance jobs;
- notification templates/providers;
- audit logging;
- analytics;
- role-specific UI consoles.

### Tier 3 — Reference only initially

- historical migrations;
- seed scripts;
- one-off diagnostics;
- individual UI components with no business logic;
- generated/build artifacts;
- every individual test file after representative tests are understood.

---

## 19. Recommended Reading Order

```text
01 System Overview
        ↓
03 Application Layer Architecture
        ↓
05 Database Schema / ERD
        ↓
07 Leave Creation End-to-End
        ↓
08 Approval Workflow
        ↓
09 Parent Approval
        ↓
10 QR & Movement
        ↓
12 Outbox
        ↓
13 Auth / Authorization
        ↓
16 Security
        ↓
18 Testing
        ↓
15 Deployment / Infrastructure
        ↓
22 Interview Defense
        ↓
23 Gaps
```

For actual code navigation, use the feature-to-file map rather than opening files randomly.

---

## 20. Feature-to-Code Map

| Feature | Start here | Follow to |
|---|---|---|
| Create leave | `src/app/api/v1/leaves/route.ts` | DTO → `create-leave.service.ts` → leave repositories → policy/workflow → DB |
| Approve leave | leave approve route | approval service → `leave-approval.repository.ts` → workflow engine → QR/outbox |
| Parent approval | parent approval route | token/hash validation → approval service → workflow |
| Generate QR | movement QR service | QR repository → crypto utilities |
| Scan QR | `src/services/movement/scan-qr.service.ts` | QR repository → movement recording → audit/outbox |
| Outbox | `src/services/outbox/` | repository → worker → notification handlers/providers |
| Authentication | `src/lib/auth/` | current-user resolution → role/scope checks |
| Dashboard | dashboard service/repositories | aggregation queries → analytics semantics |
| Rate limiting | rate-limit repository/service | route integration → `rate_limit_entries` |

---

## 21. How We Will Use This Document to Learn the Repository

For every feature we study, answer these questions in order:

1. **What business problem does it solve?**
2. **What is the end-to-end request flow?**
3. **Which route starts it?**
4. **Which DTO validates input?**
5. **Which service owns the business logic?**
6. **Which repositories touch the database?**
7. **What tables are involved?**
8. **What must be atomic?**
9. **What can race concurrently?**
10. **What authorization/scoping rule applies?**
11. **What outbox/audit side effects occur?**
12. **Which tests prove the important invariants?**
13. **What has actually been load-tested?**
14. **What remains unverified?**

If a question cannot be answered from the code/docs/tests, mark it **NOT VERIFIED** and inspect the relevant source before answering.
