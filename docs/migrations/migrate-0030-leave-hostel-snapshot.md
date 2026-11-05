# Migration: Leave Request Hostel Snapshot (0006)

## Overview

Historically, `leave_requests` contained only `student_id`, and all hostel information was derived on the fly via `student -> user -> hostel_id`. When a student transferred between hostels, past leave records incorrectly displayed under the student's new hostel, and staff access control erroneously permitted new hostel wardens to see old leaves while revoking access from the hostel where the leave was taken.

Migration `0006_leave_request_hostel_snapshot` introduces:
- `hostel_id`: Immutable UUID referencing `hostels(id)` (ON DELETE RESTRICT). Prevents hard-deleting a hostel with attached historical leaves, enforcing soft-deactivation.
- `hostel_name`: Immutable snapshot of the hostel's name at creation time.
- `is_hostel_backfilled`: Boolean indicating if the snapshot was backfilled from the migration baseline rather than captured at creation.
- B-tree index on `leave_requests(hostel_id)`.

## Legacy Backfill Strategy & Limitations

1. **Baseline**: Existing leave requests created prior to this migration are backfilled from the student's assigned hostel (`users.hostel_id`) at the time the migration is applied.
2. **Transfer Limitation**: If a student moved between hostels *prior* to this migration, historical leaves are backfilled with the student's current hostel because historical transfer dates were not tracked in the legacy schema. Those records are flagged with `is_hostel_backfilled = true` to denote they are estimated baselines rather than verified point-in-time snapshots.
3. **Unassigned Students**: Leaves submitted by students without a hostel assignment remain `hostel_id = NULL` and `is_hostel_backfilled = false`.
4. **Post-Migration Leaves**: All leaves submitted after migration capture the student's verified hostel in real-time (`is_hostel_backfilled = false`).

## Access Control & Query Scoping

- Leave queries and staff authorization inspect `leave_requests.hostel_id` directly.
- The system **does not** fall back to `users.hostel_id` for post-migration leaves. If a leave was created with `hostel_id = NULL` (unassigned/day scholar), subsequent assignment of that student to a hostel will never grant hostel-scoped wardens access to those earlier unassigned leaves.
