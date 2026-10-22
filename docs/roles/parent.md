# PARENT (Guardian)

**Label:** Parent | **Dashboard:** none (tokenized link only) | **Home Route:** `/parent-approve/[token]`

> Parent is **not a system role**: it appears in neither `ROLES` nor `ROLE_HIERARCHY`, holds no `user_roles` rows, and can never approve via the role hierarchy. A parent is an *external approver* bound to one specific leave through a single-use token. Everything below flows from that constraint.

## Permissions
| Capability | Access |
|---|---|
| Approve/reject own child's pending leave | ✅ (via approval link only) |
| View the leave details attached to the link | ✅ (same link, no login) |
| Log in (Clerk session, JWT, OTP) | ❌ (no such flow exists) |
| Dashboards, QR passes, workflows, users, analytics, settings | ❌ |
| Approve any other student's leave | ❌ (token is scoped to one approval row) |
| Re-decide after responding | ❌ (link is single-use) |

## What a Parent Can Do
- **Approve or reject** their child's leave from the link received by SMS or email (`/parent-approve/[token]`)
- **View that leave's details** (dates, reason, student) on the same page — no account needed
- **Be CC'd** on the student's approval emails (STUDENT + PARENT recipients on `leave_approved_email_*`)

## What a Parent Cannot Do
- Log in, hold a session, or use OTP — none of these mechanisms exist for parents
- See dashboards, QR passes, other students, or any admin surface
- Act after the link expires (**24h**, `PARENT_APPROVAL_TOKEN_EXPIRY_HOURS`) or after responding

## Parent Approval Flow
```
Leave reaches parent step → token generated (sha256-hashed, stored on leave_approvals.parentApprovalToken, 24h expiry)
→ SMS/email link sent → parent opens /parent-approve/[token] → Approve/Reject
→ decision recorded with source → workflow advances (POC/Admin) or ends (rejection mail)
```

## Security Properties (do not weaken)
- The raw token from the URL is a **bearer credential**: it is hashed before any lookup and never persisted raw (rate-limit keys use the hash too)
- Invalid, expired, already-used, and rate-limited links all render the **same generic failure state** — the page must not become a validity oracle (real reason is server-logged only)
- Services live in `services/parent/*` (`generate-parent-approval`, `get-leave-details-by-token`, `parent-approve-decision`); do not introduce session/JWT/OTP parent auth without strong justification
- Parent records themselves are managed by Super Admin (`/super-admin/parents`); editing a record never grants access — only a fresh token link does
