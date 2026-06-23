Two minor issues worth flagging:
1. Navigation redundancy — The sidebar has both "Approvals" (with extension tab) and "Extension Approvals" (dedicated page). Users will be confused about which to use. Recommend removing the dedicated  extension-approvals  page and its sidebar entry since the Tabs page already covers both.
2. Dual data paths in ApprovalDetailView — Reading from both  _raw  and flattened  leave  fields with  ??  fallbacks means if the API shape changes, the component silently falls back to different data rather than failing visibly. Example:  lr.status ?? leave.status  — if the API changes the  status  field name in the nested response, it silently uses the flattened value instead. A single source of truth would be more maintainable.
The rest looks functionally correct — Super Admin can now approve/reject leaves through the same pipeline as POC/Admin.


















Audit Order (Highest ROI)
1. Empty / Suspicious Directories

Immediately inspect:

src/hooks/
src/utils/
src/types/auth/
src/types/shared/
src/types/leave/
src/types/movement/
src/dto/auth/
src/dto/movement/
src/services/auth/
src/services/qr/

Questions:

Is this folder intentionally empty?

Or forgotten?

Or dead architecture?
Red Flag

If a folder exists but remains empty after several sprints:

hooks/
utils/
services/auth/

either:

Delete it

or

Implement it

Don't keep architecture placeholders forever.

2. Barrel Export Audit

Check:

services/index.ts
lib/auth/index.ts
validators/index.ts
constants/*/index.ts
movement/index.ts

Questions:

Are these actually used?

Or dead files?

Many projects accumulate:

export * from "./something";

that nobody imports.

3. DTO Audit

Current:

dto/
├── leave
├── parent
├── auth
├── movement

Verify:

Every Route Has DTO

Example:

POST /leaves
    create-leave.dto.ts

POST /approve
    approve-leave.dto.ts

POST /cancel
    cancel-leave.dto.ts

Check:

generate-qr
scan-qr
record-movement
parent approval
otp verification

If route exists and DTO doesn't:

Architecture violation
4. Type Duplication Audit

Most dangerous area.

Search:

WorkflowStep
CurrentUser
LeaveStatus
MovementState
NotificationEvent
DomainEvent

Verify:

Only one source of truth.

Example:

BAD

services/workflow-engine.ts

type WorkflowStep = ...

and

types/workflow/workflow-step.ts

type WorkflowStep = ...

Choose one.

5. Constants Audit

Check:

constants/

Against:

services/
repositories/

Search for:

"PENDING"
"APPROVED"
"REJECTED"

"ACTIVE"
"USED"

"CHECKED_OUT"

If literals still exist:

Replace with constants.
6. Repository Audit

Check every repository.

Rule:

Repository
=
Persistence only

No:

Business logic

State transitions

Authorization

Workflow logic

Example:

Good

findById()

create()

update()

Bad

approveLeave()

inside repository.

7. Service Audit

Check every service.

Rule:

Service
=
Business Logic

No:

Raw Drizzle

Raw Schema Access

Direct SQL

Should be:

Service
→ Repository

always.

8. Outbox Audit

Now that you implemented it.

Verify:

Every state-changing action emits event.

Expected:

create leave
approve leave
reject leave
cancel leave
complete leave
expire leave
create extension
approve extension
reject extension
generate qr
scan qr
record movement

If any mutate state but don't emit:

Outbox gap
9. Audit Service Audit

Verify:

create leave
approve leave
reject leave
cancel leave
complete leave
expire leave
extension approval
movement updates
qr generation
qr scan
parent approval

All should write audit logs.

10. Notification Audit

Verify:

notification.service
providers
templates
logs

Questions:

Are notifications actually triggered?

Or only infrastructure exists?

Very common issue:

notification service built

never called
11. Policy Engine Audit

Check:

MAX_DAYS

RESTRICT_BATCH

REQUIRE_PARENT_APPROVAL

MAX_EXTENSION_COUNT

BLOCK_DURING_PERIOD

Ask:

Implemented?

Partially implemented?

Stub?
12. Workflow Engine Audit

Check:

workflow-engine.ts
workflow.repository.ts
approval steps

Questions:

Does engine actually resolve workflows?

Or repository is doing everything?
13. Parent Approval Audit

This is new.

Verify:

Token generation

OTP

Verification

Approval

Audit

Outbox

Notification

Most bugs hide here.

14. Frontend Audit

Check:

features/leaves
components/shared
components/ui

Look for:

any

and:

mock data

Example:

StudentLeaveDashboard

Still likely mock-only.

That's okay now.

Just label it clearly.

15. Dependency Audit

Check package.json.

Remove:

unused libraries

duplicate libraries

experimental libraries

Especially:

eslint plugins
unused auth packages
unused toast packages