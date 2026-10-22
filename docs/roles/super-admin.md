# SUPER_ADMIN

**Label:** Super Admin | **Dashboard:** `/super-admin/dashboard` | **Home Route:** `SUPER_ADMIN_DASHBOARD`

## Permissions
| Permission | Access |
|---|---|
| `dashboard:read` | ✅ |
| `leaves:read` | ✅ |
| `leaves:write` | ✅ |
| `workflow:read` | ✅ |
| `workflow:write` | ✅ |
| `qr:read` | ✅ |
| `qr:write` | ✅ |
| `users:read` | ✅ |
| `users:write` | ✅ |
| `analytics:read` | ✅ |
| `settings:read` | ✅ |
| `settings:write` | ✅ |

## What a Super Admin Can Do
- **Everything an ADMIN can do**, across all hostels and departments
- **Full user management**: Create, update, delete users and role assignments
- **System settings**: Configure global settings including `BASE_URL`, email providers, SMS providers
- **Workflow management**: Create, edit, delete workflow definitions and steps
- **Notification configuration**: Manage templates and rules (`/super-admin/notification-templates`, `/super-admin/notification-rules`)
- **Hostel/Department management**: Create, update, delete hostels and departments
- **Leave type configuration**: Define and manage all leave types
- **Parent management**: View and manage parent records and approval links
- **Delivery logs**: View notification delivery logs (`/super-admin/notifications/delivery-logs`)
- **Academic groups**: Manage academic group structures
- **Policies**: Configure and manage leave policies

## Key Super Admin Routes
| Route | Path | Purpose |
|---|---|---|
| Dashboard | `/super-admin/dashboard` | System-wide overview |
| Analytics | `/super-admin/analytics` | Cross-hostel statistics |
| Workflows | `/super-admin/workflows` | Configure approval chains |
| Policies | `/super-admin/policies` | Define leave policies |
| Users | `/super-admin/users` | Manage all system users |
| Parents | `/super-admin/parents` | Manage parent records and tokenized approval links |
| Settings | `/super-admin/settings` | System configuration |
| Approval Templates | `/super-admin/notification-templates` | Email/Slack/SMS templates |
| Notification Rules | `/super-admin/notification-rules` | Route events to recipients |
| Delivery Logs | `/super-admin/notifications/delivery-logs` | Notification delivery audit |
| Leave Types | `/super-admin/leave-types` | Define leave categories |
| Hostels | `/super-admin/hostels` | Manage hostels |
| Departments | `/super-admin/departments` | Manage departments |
| Students | `/super-admin/students` | View all students |
| Academic Groups | `/super-admin/academic-groups` | Manage academic structures |
| Movements | `/super-admin/movements` | Cross-hostel movement history |
| Overdue | `/super-admin/overdue` | System-wide overdue alerts |

## Notification Triggers
- All `LEAVE_APPROVED`, `LEAVE_REJECTED`, `PARENT_APPROVAL_REQUESTED`, `LEAVE_OVERDUE` events
- All channels: Email, SMS, Slack
- Template management and rule configuration

## Parent Approval Flow
- Parents approve via **tokenized links** (sha256-hashed, matched against `leave_approvals.parentApprovalToken`)
- No JWT/session cookies, no OTP, no Clerk auth
- Sources tracked: `EMAIL`, `PORTAL`
- Expiry enforced via `leave_approvals.parentApprovalExpiresAt`
