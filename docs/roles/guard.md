# GUARD

**Label:** Gate | **Dashboard:** `/guard/scanner` | **Home Route:** `GUARD_SCANNER`

## Permissions
| Permission | Access |
|---|---|
| `qr:read` | ✅ |
| `qr:write` | ✅ |
| `dashboard:*` | ❌ |
| `leaves:*` | ❌ |
| `workflow:*` | ❌ |
| `users:*` | ❌ |
| `analytics:*` | ❌ |
| `settings:*` | ❌ |

## What a Guard Can Do
- **Scan QR codes** at the hostel gate to verify student authorization
- **Read QR pass data** (token, identifier) — QR is authorization only, not history
- **Record movement events** (`movement_events` table) when students check in/out
- **View movement history** for audit purposes

## What a Guard Cannot Do
- Submit, approve, or reject leave requests
- View student leave details or leave history
- Manage workflows, users, or settings
- View analytics or dashboards
- Access any notification configuration

## QR Rules
- QR payload contains only `token` and `identifier`
- QR does NOT contain: movement history, leave history, workflow history
- QR represents **authorization** at the gate, not a leave history record

## Movement Flow
```
Student scans QR at gate → Guard scans → movement_event created (CHECK_IN or CHECK_OUT)
→ Movement event stored in `movement_events` table
```

## Important Distinction
- **Leave approval is permission** (workflow-driven)
- **Movement is reality** (QR scan-driven)
- These systems are completely independent — a student can have approved leave but no QR scan, or a QR scan without approved leave
