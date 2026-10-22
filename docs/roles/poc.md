# POC (Point of Contact)

**Label:** POC | **Dashboard:** `/poc/dashboard` | **Home Route:** `POC_DASHBOARD`

## Permissions
| Permission | Access |
|---|---|
| `dashboard:read` | ✅ |
| `leaves:read` | ✅ |
| `workflow:read` | ✅ |
| `qr:*` | ❌ |
| `workflow:write` | ❌ |
| `users:*` | ❌ |
| `analytics:*` | ❌ |
| `settings:*` | ❌ |

## What a POC Can Do
- **View pending leave requests** requiring POC review (workflows with POC approval step)
- **Read leave details** for students in their hostel scope
- **Approve or reject** leaves at the POC step
- **View workflow configuration** (read-only)
- **Submit POC review comments** via the approval flow

## What a POC Cannot Do
- Create or modify leave requests
- Write workflows or change approval chains
- Manage users, hostels, or departments
- View analytics or settings
- Generate QR passes
- Approve leaves that require ADMIN or higher (unless escalated via `canRoleApprove`)

## Leave Flow for POC
```
Leave Submitted → POC Review (if workflow requires) → ADMIN Approval → (optional) Parent Approval → Approved/Rejected
```

## Scope
- POC access is **hostel-scoped** by default (`scopeType: HOSTEL`)
- Can only see and act on leaves from students in their assigned hostel
- A user can hold both POC and ADMIN roles simultaneously

## Notification Triggers (POC-relevant)
| Event | Channel | Template |
|---|---|---|
| `LEAVE_SUBMITTED` | Slack | `leave_submitted_slack_{leaveType}_poc` |
| `LEAVE_POC_REVIEW_REQUIRED` | Slack | `leave_submitted_slack_{leaveType}_poc` |
| `LEAVE_REJECTED` | Email | `leave_rejected_email_{leaveType}_poc` |

## Special Note for Late Stay
- `LATE_STAY_COLLEGE` has a unique flow: POC approves first, then ADMIN reviews the POC-approved leave
- POC sees: "Late Stay at College request awaiting your review"
- After POC approval, ADMIN sees: "Late Stay at College request approved by the POC is awaiting your review"
