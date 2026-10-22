# 18 — Testing Strategy & Quality Assurance

**Purpose:** Comprehensive inventory of the automated test suite, coverage mapping, test categories, architectural boundaries, and identified test gaps.  
**Audience:** QA engineers, backend developers, and engineering leads.  
**Status:** **IMPLEMENTED** (Verified directly from `tests/**/*.spec.ts`)

---

## 1. Test Suite Architecture & Runners

The repository employs a multi-tiered automated testing pyramid:

* **Primary Test Runner**: Vitest 4.1.8 (`vitest.config.ts`), with jsdom environment for React components.
* **Component Testing**: React Testing Library (`@testing-library/react`), `@testing-library/jest-dom`.
* **Performance / E2E Runner**: Playwright (`playwright.config.ts`, `performance/audit.spec.ts`).
* **Architectural Boundaries**: Custom bash verification script (`scripts/audit-architecture.sh`) and ESLint boundaries.

---

## 2. Test Suite Breakdown by Category

The repository houses over 80 dedicated test suites in `tests/`:

### 2.1 State Machine & Core Domain Specs
* `tests/leave-state-machine.spec.ts`: Tests all legal and illegal transitions on `leave_requests`.
* `tests/movement-state-machine.spec.ts`: Validates movement transitions (`IN_HOSTEL` $\rightarrow$ `OUTSIDE_HOSTEL` $\rightarrow$ `RETURNED` / `OVERDUE`).
* `tests/policy-engine.spec.ts`: Unit tests curfew calculations, blocked periods, max days, and batch year restrictions.
* `tests/workflow-engine.spec.ts`: Verifies step ordering, first step detection, and auto-approval skips.

### 2.2 Service & Transactional Specs
* `tests/create-leave.service.spec.ts`: Validates student checks, date overlap guard, atomic creation, and outbox event emissions.
* `tests/approve-leave.service.spec.ts`: Tests step advancement, final QR pass generation, and multi-warden locking.
* `tests/scan-qr.service.spec.ts`: Tests exit scan, return scan, double scan prevention, and expired pass rejection.
* `tests/generate-parent-approval.service.spec.ts`: Tests token hashing, 48-hour expiration computation, and SMS outbox payload.
* `tests/parent-approval.service.spec.ts`: Tests token verification, expired link rejection, and status updates.

### 2.3 Outbox & Asynchronous Messaging Specs
* `tests/outbox.repository.spec.ts`: Tests atomic lease claiming (`claimNext`), concurrency skips, and lease timeouts.
* `tests/outbox.service.spec.ts`: Tests idempotent insertion.
* `tests/outbox-worker.spec.ts`: Tests retry limits, transient error handling, and poisoned message quarantine.
* `tests/outbox-leave-event-handler.spec.ts` & `tests/outbox-movement-event-handler.spec.ts`.

### 2.4 Cryptographic & Security Specs
* `tests/qr-token-crypto.spec.ts`: Verifies AES-256-GCM encryption envelope roundtrips and IV randomness.
* `tests/authorization-scope.spec.ts`: Verifies hostel-scoping restrictions and multi-tenant access blocks.
* `tests/rate-limiter.spec.ts`: Verifies request throttling on sensitive gate and approval endpoints.

---

## 3. Test Coverage Matrix for Business Invariants

| Architectural Invariant | Target Code Path | Verifying Test Suite |
| :--- | :--- | :--- |
| Non-overlapping leaves for QR types | `overlap-guard.service.ts` | `tests/create-leave.service.spec.ts` |
| Leave Approval is NOT Movement | `approve-leave.service.ts` | `tests/approve-leave.service.spec.ts` |
| Guard cannot approve leaves | `roles.ts`, `approve-leave.service.ts` | `tests/auth/require-role.spec.ts` |
| Pass scan requires active window | `scan-qr.service.ts` | `tests/scan-qr.service.spec.ts` |
| Double scan prevention at gate | `scan-qr.service.ts` | `tests/scan-qr.service.spec.ts` |
| Parent token hashed with SHA-256 | `generate-parent-approval.service.ts` | `tests/generate-parent-approval.service.spec.ts` |
| Outbox lease expires after 5 mins | `outbox.repository.ts` | `tests/outbox.repository.spec.ts` |
| Cron endpoints fail closed without secret | `cron-auth.ts` | `tests/cron-routes.spec.ts` |
| Email verification required for Clerk linking| `get-current-user.ts` | `tests/auth/get-current-user.spec.ts` |

---

## 4. Important Untested Scenarios & Gaps

While coverage of happy paths and domain state machines is thorough, the following high-concurrency scenarios lack automated stress tests:

1. **High-Concurrency Millisecond Submission Collisions**:
   * *Untested*: Two concurrent leave requests submitted in the exact same millisecond to test `request_number` collision handling.
2. **Postgres Connection Partition During Outbox Lease**:
   * *Untested*: Simulating database connection failure halfway through an outbox batch to verify partial rollbacks.
3. **Multi-Instance Gate Scan Load**:
   * *Untested*: High-throughput simulated stress test (500 scans/second) across multiple gate lanes.
