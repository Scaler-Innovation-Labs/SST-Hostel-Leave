# Leave / QR / Movement — State-Transition Contract

Status: **Governing contract** — every service and test in the leave + movement domain
must conform to this. Derived from the domain review (Aug 2026); supersedes any
inconsistent behavior found in the code.

---

## 1. Two independent axes

A leave request's **lifecycle status** and a student's **physical location** are
different concepts. No transition on one axis may implicitly mutate the other.

```
AXIS A — leave_requests.status (authorization lifecycle)
PENDING → APPROVED → COMPLETED | EXPIRED | OVERDUE | CANCELLED | REJECTED

AXIS B — students.currentLocationState (physical truth)
IN_HOSTEL ⇄ OUTSIDE_HOSTEL   (overdue: OUTSIDE_HOSTEL → OVERDUE → IN_HOSTEL)
```

- **APPROVED** means "this leave is authorized". It says nothing about location.
- **Current leave** (derived): `status = APPROVED AND startAt <= now <= endAt`.
- **Upcoming leave** (derived): `status = APPROVED AND startAt > now`.
- **History** (derived): COMPLETED / EXPIRED / OVERDUE / CANCELLED / REJECTED.

### Deprecated states
- `APPROVED_LEAVE` (movement): **removed**. Authorization is derived from the leave,
  never stored on the student. Approval must not mutate `currentLocationState`.
- `CHECKED_OUT` (movement): **merged into OUTSIDE_HOSTEL**. Manual checkout becomes
  `IN_HOSTEL → OUTSIDE_HOSTEL` with `eventType = MANUAL_CHECKOUT`,
  `movementMethod = MANUAL`.
- `RETURNED` (enum): dead — delete from the enum and seeds.

---

## 2. QR usability model

A QR pass is a **record** that belongs to exactly one leave
(`unique(leaveRequestId, qrType)`). It has two independent attributes:

| Attribute | Meaning |
|---|---|
| `status` | lifecycle of the credential: ACTIVE / USED / EXPIRED / INVALIDATED |
| window | `valid_from <= now <= expires_at` (valid_from = leave startAt; expires_at = leave endAt + return grace) |

> **A pass can be ACTIVE but not usable.** A future approved leave has an ACTIVE
> pass record (so the approval email can carry the QR image) that is **not
> scannable** until `valid_from` arrives.

**Usable for EXIT** ⟺ `status = ACTIVE AND valid_from <= now <= expires_at`
**Usable for RETURN** ⟺ `status = ACTIVE AND firstScanAt IS NOT NULL AND closedAt IS NULL`

### Open movement session (derived — no new table)
```
session open  ⟺  qr_pass.firstScanAt IS NOT NULL AND closedAt IS NULL
session owner ⟺  that qr_pass (and thus its leaveRequestId)
```

### Invariant (service-enforced, NOT a DB unique index)
> At most one **currently usable** (in-window, open or exit-able) movement QR per
> student. Future leaves may hold ACTIVE-but-gated pass records; those do not count.
> Enforced in generate/scan services, not by a partial unique index.

---

## 3. Transition contract

Every transition lists: trigger → preconditions → resulting states → side effects.

| # | Trigger | Preconditions | leave.status | location | QR | Events / side effects |
|---|---|---|---|---|---|---|
| T1 | Submit leave | form valid, policy ok, overlap rule ok (§5) | PENDING | unchanged | — | approvals + workflow steps created; LEAVE_CREATED outbox |
| T2 | Final workflow step approves | leave PENDING | APPROVED | **unchanged** | pass created, ACTIVE, window-gated | LEAVE_APPROVED outbox; **no movement event** |
| T3 | Window opens (startAt passes) | leave APPROVED | APPROVED | unchanged | becomes usable (derived) | no job; evaluated at scan/read |
| T4 | EXIT scan | location IN_HOSTEL; leave = current; pass usable-for-exit; **no open session** | APPROVED | OUTSIDE_HOSTEL | firstScanAt set (session opens) | qr_scan_log SUCCESS; event EXIT_HOSTEL; QR_SCANNED outbox |
| T5 | RETURN scan | location OUTSIDE_HOSTEL or OVERDUE; pass is the open session's pass; pass usable-for-return | **COMPLETED** (actualReturnAt = now) | IN_HOSTEL | closedAt set, status USED (session closes) | event ENTER_HOSTEL; LEAVE_COMPLETED + QR_SCANNED outbox |
| T6 | Window ends, never scanned | leave APPROVED, no session, no return | **EXPIRED** | unchanged (IN_HOSTEL) | INVALIDATED | event QR_INVALIDATED (no location change); LEAVE_EXPIRED outbox |
| T7 | Window ends, session open | pass firstScanAt set, closedAt null, endAt passed | **OVERDUE** | **OVERDUE** | stays usable-for-return | **single** overdue job sets all three atomically; event AUTO_OVERDUE; LEAVE_OVERDUE outbox |
| T8 | Return while overdue | location OVERDUE; pass = open session's pass | COMPLETED | IN_HOSTEL | USED / closed | event ENTER_HOSTEL; LEAVE_COMPLETED outbox |
| T9 | Manual return (admin) | location OUTSIDE_HOSTEL or OVERDUE; leave APPROVED/OVERDUE | **COMPLETED** (actualReturnAt = now) | IN_HOSTEL | **closed (USED, closedAt)** if open session | event MANUAL_RETURN; LEAVE_COMPLETED outbox; audit; notification |
| T10 | Manual checkout (guard/admin) | location IN_HOSTEL; optionally bound to current leave | unchanged | OUTSIDE_HOSTEL | — (no QR session) | event MANUAL_CHECKOUT; audit |
| T11 | Cancel approved leave | location IN_HOSTEL; window not started or in progress | CANCELLED | unchanged | INVALIDATED | LEAVE_CANCELLED outbox; no movement event (location already IN_HOSTEL) |
| T12 | Cancel while outside/overdue | — | **rejected** | unchanged | — | error: must return first |
| T13 | Invalidate QR (admin) | pass usable-for-exit only (no open session) | unchanged | unchanged | INVALIDATED | audit QR_INVALIDATED; no movement if location IN_HOSTEL |
| T14 | Extension approved | leave APPROVED or OVERDUE; overlap rule ok | APPROVED (endAt extended) | unchanged | expires_at = new endAt + grace | LEAVE_EXTENSION_APPROVED outbox; no movement event |
| T15 | Regenerate QR | leave = current; pass not in open session | unchanged | unchanged | old token invalidated, new token written to same row | audit; QR_GENERATED outbox |
| T16 | Non-QR leave ends | leave APPROVED, no movement tracking | **COMPLETED** (auto at endAt) | unchanged | — | LEAVE_COMPLETED outbox |

**Conformance rules**
- The only writers of `currentLocationState` are `recordMovement`-driven transitions
  (T4, T5, T7, T8, T9, T10) — **never approval** (T2) or cancel (T11).
- Every location change produces exactly one `movement_events` row + one outbox event.
- `recordMovement` remains the single choke point for location changes.
- No service may complete a leave (T5/T8/T9/T16) without also resolving the session.

---

## 4. Overlap policy (MVP, deterministic)

Applies at **submission** (T1) and **extension approval** (T14) — never at scan time.

| New leave \ existing | QR-enabled (movement-capable) | Non-QR |
|---|---|---|
| QR-enabled | ❌ reject | ❌ reject while windows overlap |
| Non-QR | ❌ reject while windows overlap | ✅ allow (same-type guard remains) |

- Overlap = `new.startAt <= existing.endAt AND existing.startAt <= new.endAt`
  over APPROVED/PENDING leaves (same student).
- Rationale: two windows can never compete for one location / one exit / one return /
  one QR / one overdue state.
- Configurable later via a `OVERLAP_RULE` policy; not now.

---

## 5. Read-model rules (dashboard / QR page / history)

Never "first ACTIVE QR row". Always resolve in this order:

```
Student
  → open session (if any) → its leave   → that leave's QR
  → else current leave (window contains now) → its QR
  → else none
```

- `/student/qr` (or dashboard QR card) shows:
  - Current leave + QR (if usable) — or "QR available from <valid_from>"
  - Upcoming leave: "QR available from <startAt>" (no QR shown)
  - History: no QR.
- `activeLeave` in dashboard stats = session leave, else window-contained leave —
  **never** "most recently approved".

---

## 6. Overdue — single source of truth

One job, one predicate:
```
open session (firstScanAt set, closedAt null) AND leave.endAt < now
```
Atomically sets: `leave.status = OVERDUE`, `location = OVERDUE`,
`movement_event = AUTO_OVERDUE`, `notification = LEAVE_OVERDUE`.
The movement-state-only `mark-overdue.job` (no leave predicate) is **removed**.

---

## 7. Implementation order

1. **Temporal** — T2 no-movement; current/upcoming derivation; read-model (Phase 1)
2. **QR** — valid_from; scan window check; session ownership at scan; single-usable
   enforcement; regeneration (Phase 2)
3. **Movement** — manual return closes everything (T9); double-scan guards; history
   (Phase 3)
4. **Overlap** — generic overlap detection at submit + extension (Phase 4)
5. **Lifecycle** — one overdue job; expiry/completion (T6/T16); cancel; extensions
6. **Migration** — reconcile future leaves wrongly marked movement-active; settle
   location; gate/close stray ACTIVE passes; fix overlapping legacy rows; regression tests
