# ADMIN (Hostel Admin)

**Label:** Admin | **Dashboard:** `/admin/dashboard` | **Home Route:** `ADMIN_DASHBOARD`

## Permissions
| Permission | Access |
|---|---|
| `dashboard:read` | ✅ |
| `leaves:read` | ✅ |
| `workflow:read` | ✅ |
| `workflow:write` | ✅ |
| `qr:read` | ✅ |
| `qr:write` | ✅ |
| `analytics:read` | ✅ |
| `users:*` | ❌ |
| `settings:*` | ❌ |

## What an Admin Can Do
- **Full leave management**: View, approve, reject all leaves within their hostel scope
- **Workflow management**: Read and write workflow configurations (approval chains are config-driven, not hardcoded)
- **QR pass management**: Generate and view QR passes for students
- **Analytics**: Read hostel-level leave statistics
- **View all roles**: Read user roles and permissions
- **Manage hostel-level data**: Students, leave types, department assignments

## What an Admin Cannot Do
- Manage global users (create/delete super admins, system-wide user management)
- Access system settings
- Configure notification templates or notification rules (SUPER_ADMIN only)
- Manage parent approval links (SUPER_ADMIN only)
- Manage hostels/departments globally (SUPER_ADMIN only)

## Scope
- Admin access is **hostel-scoped** (`scopeType: HOSTEL`)
- Only sees leaves from students in their assigned hostel
- An unrestricted admin (`scopeType: null`) sees all hostels
- A single admin can be scoped to multiple hostels (multiple `user_roles` rows with different `scopeId`)

## Leave Flow for Admin
```
Leave Submitted → POC Review (if required by workflow config) → ADMIN Approval → (optional) Parent Approval → Approved/Rejected
```

## Key Admin Routes
| Route | Path | Purpose |
|---|---|---|
| Dashboard | `/admin/dashboard` | Overview of pending leaves, stats |
| Approvals | `/admin/approvals` | Review and approve/reject leaves |
| Extension Approvals | `/admin/extension-approvals` | Review leave extension requests |
| Movements | `/admin/movements` | View movement history (QR check-in/out events) |
| Overdue | `/admin/overdue` | Students who checked out but haven't returned |
| Analytics | `/admin/analytics` | Hostel-level leave statistics |

## Notification Triggers (Admin-relevant)
| Event | Channel | Template |
|---|---|---|
| `LEAVE_SUBMITTED` | Slack | `leave_submitted_slack_{leaveType}_admin` |
| `LEAVE_APPROVED` | Email | `leave_approved_email_{leaveType}` |
| `LEAVE_REJECTED` | Email | `leave_rejected_email_{leaveType}_admin` |
| `PARENT_APPROVAL_REQUESTED` | SMS | `parent_approval_requested_sms_{leaveType}` |
| `LEAVE_OVERDUE` | Email | `leave_overdue_email_student` (to student) |

## Hostel-Scoped Notification Behavior
- `HOSTEL_ADMIN` recipients are filtered by hostel match
- If no admin covers the leave's hostel, zero contacts resolve — the notification is marked PROCESSED with no delivery
- This is now logged as a warning (`Notification rules matched but no recipients resolved`)
