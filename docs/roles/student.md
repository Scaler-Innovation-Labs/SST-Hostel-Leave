# STUDENT

**Label:** Student | **Dashboard:** `/student/dashboard` | **Home Route:** `STUDENT_DASHBOARD`

## Permissions
| Permission | Access |
|---|---|
| `dashboard:read` | ✅ |
| `leaves:read` | ✅ |
| `leaves:write` | ✅ |
| `qr:read` | ✅ |
| `qr:write` | ❌ |
| `workflow:*` | ❌ |
| `users:*` | ❌ |
| `analytics:*` | ❌ |
| `settings:*` | ❌ |

## What a Student Can Do
- **Submit leave requests** (all leave types: Exam, Long, Late Entry, Late Stay, Different Hostel, Holiday, Internship, Attendance Exception)
- **View their own leave history** and current status
- **Request leave extensions** on existing leaves (creates `leave_extensions` records, never new leaves)
- **View QR pass** for active leave (QR is authorization only, not history)
- **Cancel a submitted leave** before any approval step
- **View their checkout status** (manual return/overdue alerts)

## What a Student Cannot Do
- Approve/reject any leave (including their own)
- Manage users, roles, or hostels
- Configure workflows or notification templates
- View other students' leave data

## Leave Flow for Students
```
Submit Leave → POC Review (if applicable) → Warden/Admin Approval → (optional) Parent Approval → Approved/Rejected
```

## Key Forms
- Dynamic forms driven by `leave_types.form_schema` and `leave_requests.submitted_form`
- No hardcoded columns for individual form fields
