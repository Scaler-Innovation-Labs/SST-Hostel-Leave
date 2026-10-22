# Migration 0024 — Configuration Versioning & Schema Cleanup

Run: `pnpm tsx scripts/migrate-0024-dead-schema-removal.ts`

## Why

Two goals:

1. **Immutability.** Configuration (leave types, workflows, policies) can
   change at any time, but an existing leave must remain explainable and
   reproducible. Old leaves already store the *facts* (submitted form,
   aggregate policy result, approval records, movement events); this
   migration adds the *configuration context* those facts were produced
   under.
2. **Cleanup.** Remove tables, columns, and enums that were never written or
   read by any code path.

## The model

```text
                    CONFIGURATION
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
      Leave Type      Workflow      Policy
          │              │              │
          └──────────────┼──────────────┘
                         ↓
              Version chains (immutable)
                         ↓
             Leave Configuration Context
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
   Policy Evaluations  Approvals       Movement Events
```

- `leave_type_versions` / `workflow_versions` / `policy_versions` — one row
  per **actual configuration change** (never per leave, never per submit).
  Once created, a version is never mutated.
- `leave_configuration_contexts` — one tiny row per leave request pointing
  at the exact `leave_type_version` and `workflow_version` the leave was
  created under. The word "configuration" (not "execution") is deliberate:
  the row answers *"which configuration did this leave use?"* — approval
  and movement execution happens later and is recorded separately.
- `policy_evaluations` — one row per policy evaluated for the leave,
  referencing the exact `policy_version`, with pass/fail, message, and the
  **input values** the decision was computed from (`config` jsonb: the
  rule's own config + resolved request inputs such as dates, batch year,
  extension count). The full policy definition is never duplicated;
  `submittedForm` already holds the form facts.

Scale: ~200 configuration versions for 120k leaves, not 120k snapshots.

## Core invariant

> **A configuration version is immutable. A leave references the versions it
> was created under. Configuration changes create new versions; they never
> modify versions already referenced by a leave.**

Runtime behavior:

```text
Configuration creation/update
        ↓
Version MUST exist (created only on actual mutation)
        ↓
Leave creation
        ↓
Resolve existing immutable versions
        ↓
Create configuration context + policy evaluations
```

The runtime **never** creates a version during normal operation — a missing
version is a data error and fails loudly (`NotFoundError`). The backfill in
this migration is the only place v1 versions are manufactured.

## What was created

| Table | Purpose |
|---|---|
| `workflow_versions` | Immutable copy of a workflow definition + frozen steps (role codes resolved). Unique `(workflow_definition_id, version)`. |
| `policy_versions` | Immutable copy of a policy row. Unique `(policy_id, version)`. |
| `leave_type_versions` | Immutable copy of a leave type row. Unique `(leave_type_id, version)`. |
| `leave_configuration_contexts` | `leave_request_id` (unique) → `leave_type_version_id` + `workflow_version_id`. |
| `policy_evaluations` | `leave_request_id` → `policy_id`, `policy_version_id`, `config` (evaluation inputs), `passed`, `message`, `evaluated_at`. |

## Write paths (code changes in this commit)

| Event | Code path |
|---|---|
| Leave type created / updated | `create-leave-type.service.ts`, `update-leave-type.service.ts` → `leaveTypeVersionService.createVersion` |
| Workflow created / updated | `save-workflow.service.ts` → `workflowVersionService.createVersion` (inside the tx) |
| Policy created / updated | `manage-policy.service.ts` → `policyVersionService.createVersion` (inside the tx) |
| Leave submitted | `create-leave.service.ts` → resolves the existing latest versions (`getLatestVersion`, throws when absent) and inserts the configuration context + per-policy `policy_evaluations` (with `config`) inside the create tx |
| Policy evaluation | `policy-engine.ts` resolves the immutable version of every policy it evaluates (throws when absent) and returns `PolicyResult.evaluations` with the evaluation `config` |

Read paths: `leave-approval.repository.ts` (`findByFilters`,
`findExtensionApprovals`) render the approval chain from the frozen
`workflow_versions.steps` and the leave type name from the frozen
`leave_type_versions.name`, falling back to the live configuration only for
leaves without a context (should not exist after the backfill below).

## What was dropped

Tables: `inbound_sms_logs`, `sheet_sync_logs`, `parent_otp_sessions`
(never-written designs; OTP was superseded by tokenized approval links).

Enums: `sms_parsed_action`, `sms_processing_status`, `sheet_sync_status`
(only used by the dropped tables).

Columns:
- `leave_requests.request_version` — no concurrency mechanism behind it
  (row locks are used instead).
- `leave_requests.leave_type_version` — replaced by `leave_type_versions`.
- `leave_requests.approval_snapshot`, `leave_extensions.approval_snapshot` —
  replaced by the version chains + configuration context.
- `leave_approvals.parent_approval_otp_hash`,
  `leave_approvals.parent_approval_verified_at` — OTP design remnants.

## What was kept

- `submittedForm`, `policyResult`, `leave_approvals`, `leave_rejections`,
  `movement_events`, `notification_logs` — immutable facts about what
  happened.
- `metadata` on `leave_requests`, `leave_extensions`, `leave_approvals`,
  `leave_rejections` — extensible audit/context slots, consistent with the
  rest of the system.
- `users.metadata`, `parents.metadata` — not in the removal scope; identity
  rows stay untouched.
- `users.last_login_at` — **kept and now written**: `get-current-user.ts`
  updates it on every authenticated request (login audit, admin security,
  inactive-user detection). The update is best-effort and never blocks the
  request.
- `notification_logs.cc_recipients` — the canonical CC storage; the
  notification service already writes it. Historical rows that stored CCs
  inside `metadata` are migrated into the column by this migration.
- `operational_periods` — **kept deliberately**: it is an unfinished feature
  (zero writers today), not dead architecture. BLOCKED_PERIOD policies
  never fire until a period-management flow exists; the policy engine
  expects the table.

## Backfill (idempotent, safe on re-run)

1. v1 `workflow_versions` per workflow, steps aggregated from
   `workflow_steps` + `roles` (`ON CONFLICT DO NOTHING`).
2. v1 `policy_versions` per policy (`ON CONFLICT DO NOTHING`).
3. v1 `leave_type_versions` per leave type (`ON CONFLICT DO NOTHING`).
4. `leave_configuration_contexts` for every existing leave request (skips
   rows that already have a context).
5. `policy_evaluations` reconstructed from `leave_requests.policy_result ->
   checks` **only when the check carries an unambiguous policy identifier**
   (`checks[].key` is the policy uuid the engine evaluated). Checks whose
   key is not a uuid, or whose policy was deleted (no v1 version row), are
   **not guessed**: the aggregate `policy_result` remains the historical
   fact and `policy_evaluations` stays empty for that leave.
6. `notification_logs.cc_recipients` backfilled from
   `metadata->'ccRecipients'` where the column is null.

## Rollback

The version tables are additive — to roll back, drop the five new tables
(`leave_configuration_contexts`, `policy_evaluations`, `leave_type_versions`,
`workflow_versions`, `policy_versions`) and restore the dropped columns if
needed. The dead-table/enum drops are one-way; nothing depended on them.

## Follow-ups (not in this commit)

- Admin UI: show "Current Version: N" on leave type / workflow / policy
  editors, with a change-reason prompt when an edit creates a new version.
- Display of frozen type name in the leave-detail pages (currently only the
  approvals list/chain uses the configuration context).
- `operational_periods` still has zero writers; BLOCKED_PERIOD policies
  never fire until a period-management flow exists.