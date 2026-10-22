# Migration 0029 — approval assignment / actor separation

## Purpose

The former `leave_approvals.approver_user_id` field had two meanings:

- when a step was created, it could store the specific assigned user;
- when a step was approved or rejected, `updateDecisionById` overwrote it with the user who acted.

The migration introduces:

- `assigned_approver_user_id`: the specific user assigned to the step, when applicable;
- `acted_by_user_id`: the user who recorded an approval or rejection, when applicable.

Role-based assignment remains represented by `approver_role_id`, and parent assignment remains represented by `approver_parent_id`.

## Backfill limits

The migration backfills assignments from the legacy column for `PENDING` and `CANCELLED` rows, because those paths retain the original value. For `APPROVED` and `REJECTED` rows, it backfills the known acting user from the legacy column, excluding `SYSTEM` decisions.

For historical decisions, the original specific assignee cannot always be reconstructed: the previous code may already have overwritten the column. The migration deliberately does not infer a historical assignee from an actor ID. Review audit records or other reliable records before attempting any extra backfill.

## Deployment

1. Back up the database and review the migration against the deployment database.
2. Run from the repository root with the correct `.env.local` configuration:

   ```bash
   npx tsx scripts/migrate-0029-approval-assignment-actor.ts
   ```

3. Deploy the application version that reads/writes the new fields.
4. Verify pending POC queue filtering, approval/rejection, parent approvals, overrides, extension approvals, staff analytics, and notifications.
5. Keep `approver_user_id` during the rollback window. Drop it only in a later contract migration after confirming the new deployment is healthy and historical data has been reconciled as far as possible.

The migration is idempotent and additive. It does not drop the legacy column.
