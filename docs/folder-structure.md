# Folder Structure

SST Hostel Leave System uses a route-grouped Next.js App Router layout with clear ownership boundaries for UI, features, infrastructure, and persistence.

## `src/app/`

Route groups keep auth and dashboard surfaces separate.

- `src/app/(auth)/` handles login, redirects, and Clerk-related entry points.
- `src/app/(dashboard)/` contains protected student, admin, POC, and super-admin areas.
- `src/app/page.tsx` is the marketing homepage.
- `src/proxy.ts` is the active Next.js request gate for this version of Next.js.
- `src/middleware.ts` is present as a compatibility alias for the older convention.

## `src/components/`

Reusable presentation infrastructure only.

- `src/components/marketing/` contains homepage/marketing sections.
- `src/components/layout/` contains app shell primitives and dashboard chrome such as `AppShell`, `DashboardNavbar`, and `DashboardSidebar`.
- `src/components/shared/` contains reusable primitives like `Logo`, `StatusBadge`, and `DataTable`.
- `src/components/ui/` contains the shadcn/ui building blocks.

## `src/features/`

Feature-owned logic is grouped by domain.

- `src/features/auth/`
- `src/features/leaves/`
- `src/features/movements/`
- `src/features/notifications/`
- `src/features/qr/`
- `src/features/workflows/`
- `src/features/dashboard/` remains as a domain area, but its shell responsibility moved into `src/components/layout/AppShell.tsx`.

Each feature is expected to own its own:

- `components/`
- `hooks/`
- `types/`
- `validators/`
- `actions/`
- `utils/`

## `src/constants/`

- `src/constants/routes.ts` centralizes route strings.
- `src/constants/navigation.ts` defines route-aware navigation data.

## `src/lib/`

Infrastructure utilities and platform helpers only.

- `src/lib/auth/` contains auth helpers, guards, roles, and RBAC policy utilities.
- `src/lib/utils.ts` remains the shared helper entry point.

## `src/providers/`

App-level providers such as `ThemeProvider` and `SWRProvider`.

## `src/repositories/`

Database access only.

## `src/services/`

Business orchestration only.

## `src/types/`

Platform-level shared types such as API response envelopes and status codes.


| Layer      | Responsibility       |
| ---------- | -------------------- |
| Repository | DB access            |
| Service    | Business logic       |
| DTO        | contracts/validation |
| Route      | HTTP handling        |
| Feature    | UI grouping          |

Recommended Backend Flow
Request Flow
route
→ validation
→ service
→ repository
→ database

NOT:

route → database

That becomes unmaintainable VERY fast.

Example
Good
POST /leave-request

↓

validate DTO

↓

leaveService.createLeaveRequest()

↓

leaveRepository.create()

↓

DB

BAD
route.ts

contains:

SQL
business rules
policy logic
notification logic
movement logic

Disaster.

Repository Layer

Repositories should ONLY do:

data access

NOT:

business logic
workflows
notifications
policies
GOOD Repository
leaveRepository.create()
leaveRepository.findById()
leaveRepository.updateStatus()

ONLY DB operations.

BAD Repository
approveLeaveAndSendMail()

NO.

That belongs in:

service layer
Service Layer

This is:

business orchestration

MOST important layer.

Example
leaveService.approveLeave()

might:

validate workflow
create approval
update leave status
generate QR
create movement event
send notification
audit action

THAT is service layer.

DTO Layer

VERY important.

You should NEVER trust frontend payloads.

Use:

Zod DTOs
Example
dto/leave/create-leave.dto.ts
export const createLeaveSchema = z.object({
  leaveTypeId: z.string().uuid(),
  reason: z.string().min(5),
  startAt: z.string(),
  endAt: z.string(),
});

Excellent architecture.

Naming Conventions

This is VERY important.

Database

Use:

snake_case

Example:

leave_requests
created_at

Correct.

TypeScript Variables

Use:

camelCase

Example:

leaveRequest
createdAt

Correct.

Files

Use:

kebab-case

Example:

create-leave.dto.ts
leave.repository.ts
leave.service.ts

Excellent consistency.

Export Names

Use:

camelCase

Example:

leaveRepository
leaveService
Constants / Enums

Use:

SCREAMING_SNAKE_CASE

Example:

LEAVE_STATUS.APPROVED
VERY IMPORTANT

Avoid magic strings everywhere.

Create:

src/constants/

Example:

export const LEAVE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
} as const;

Excellent maintainability.

Recommended Service Structure
services/
└── leave/
    ├── create-leave.service.ts
    ├── approve-leave.service.ts
    ├── reject-leave.service.ts
    ├── extend-leave.service.ts
    ├── complete-leave.service.ts
    └── index.ts

NOT:

one giant leave.service.ts

That becomes monster-file architecture.

Repository Structure
db/repositories/
└── leave/
    ├── leave.repository.ts
    ├── leave-approval.repository.ts
    ├── leave-extension.repository.ts
    └── leave-document.repository.ts

Good separation.

IMPORTANT DESIGN RULE

Repositories should return:

domain-shaped objects

NOT raw DB garbage everywhere.

Validation

Use:

Zod

Everywhere.

Especially:

route input
service input
webhook payloads
SMS parsing
RBAC

You MUST centralize authorization.

Do NOT do:

if (user.role === "ADMIN")

everywhere.

Create:

lib/auth/

Example:

requireRole()
requirePermission()

Very important later.

Suggested Next Steps
1

Create:

constants/

FIRST.

2

Create:

db/schema/
3

Setup:

drizzle.config.ts
4

Create:

db/index.ts
5

Implement:

leave.repository.ts

FIRST repository.

6

Implement:

create-leave.service.ts

FIRST service.

VERY IMPORTANT FINAL ADVICE

DO NOT OVER-ABSTRACT EARLY.

Avoid:

generic repositories
base services
factory madness
abstract classes everywhere

Keep:

explicit domain-oriented architecture

That is MUCH better for your project.

Excellent. Before touching `workflow-engine.ts`, you should understand **why each folder exists**. Otherwise you'll keep moving code around without knowing ownership.

Let's use your Leave System as the example.

---

# The Flow of a Request

When a student submits leave:

```text
POST /api/v1/leaves
        │
        ▼
     DTO
        │
        ▼
    Service
        │
        ├── Policy Engine
        ├── Workflow Engine
        ├── Repositories
        └── Audit
        │
        ▼
   Database
        │
        ▼
  ApiResponse
```

---

# 1. Drizzle Schema

Location:

```text
src/db/schema/*
```

Purpose:

```text
Database structure
```

Example:

```ts
leaveRequests
```

defines:

```text
table name
columns
constraints
indexes
foreign keys
```

---

Schema answers:

```text
What exists in the database?
```

NOT:

```text
Can a student create leave?
```

---

Example:

```ts
export const leaveRequests = pgTable(...)
```

Good.

---

# 2. Repository

Location:

```text
src/db/repositories/*
```

Purpose:

```text
Database access
```

Example:

```ts
leaveRepository.findById()
```

Repository answers:

```text
How do I read/write data?
```

NOT:

```text
Should this leave be approved?
```

---

Good:

```ts
leaveRepository.create(...)
```

Bad:

```ts
leaveRepository.approveLeave(...)
```

because approval is business logic.

---

# 3. Service

Location:

```text
src/services/*
```

Purpose:

```text
Business logic
```

Example:

```ts
createLeaveService
```

Service answers:

```text
What should happen?
```

Example:

```text
1. Find student
2. Check policy
3. Create leave
4. Create approvals
5. Create audit
6. Send notification
```

---

Service orchestrates.

Repositories execute.

---

# 4. DTO

Location:

```text
src/dto/*
```

Purpose:

```text
Incoming request contract
```

Example:

```ts
create-leave.dto.ts
```

---

Student sends:

```json
{
  "leaveTypeId": "...",
  "reason": "...",
  "startAt": "...",
  "endAt": "..."
}
```

DTO defines:

```text
What the API accepts.
```

NOT:

```text
What the database stores.
```

---

Example:

Database:

```ts
leaveRequests
```

has:

```text
id
requestNumber
status
approvedAt
...
```

User never sends these.

So DTO is smaller.

---

# 5. Zod Schema

Usually inside DTO.

Example:

```ts
const createLeaveSchema = z.object(...)
```

Purpose:

```text
Runtime validation
```

TypeScript disappears after build.

Zod survives.

---

Without Zod:

```json
{
  "startAt": 123
}
```

could enter your service.

---

Zod answers:

```text
Is the incoming data valid?
```

---

# 6. Types

Location:

```text
src/types/*
```

Purpose:

```text
Shared contracts
```

Examples:

```ts
WorkflowStep
PolicyResult
CurrentUser
ApiError
```

---

Rule:

If something is reused across multiple layers:

```text
Route
Service
Repository
```

put it in:

```text
types/
```

---

# 7. API Contract

Location:

```text
dto/
types/api/
```

Purpose:

```text
Agreement between frontend and backend.
```

Example:

Request:

```json
{
  "leaveTypeId": "123"
}
```

Response:

```json
{
  "success": true,
  "data": {}
}
```

That agreement is the API contract.

---

# 8. ApiResponse

Location:

```text
lib/api/
```

Purpose:

```text
Consistent responses
```

Instead of:

```ts
return Response.json(...)
```

everywhere.

---

Good:

```ts
ApiResponse.ok(data)
```

```ts
ApiResponse.created(data)
```

```ts
ApiResponse.fromError(error)
```

---

Every route should use it.

---

# 9. Errors

Location:

```text
lib/errors/*
```

Purpose:

```text
Expected business failures
```

Examples:

```ts
NotFoundError
ConflictError
PermissionError
ValidationError
```

---

Good:

```ts
throw new NotFoundError("Student");
```

Bad:

```ts
throw new Error("Student not found");
```

---

Because routes can handle custom errors correctly.

---

# 10. Validators

Location:

```text
validators/*
```

Purpose:

```text
Reusable validation logic
```

Example:

```ts
isValidPhone()
```

```ts
isValidRollNumber()
```

```ts
isLeaveDateRangeValid()
```

---

Rule:

### DTO Validation

```text
Request shape validation
```

Use:

```text
Zod
```

---

### Business Validation

```text
Domain rules
```

Use:

```text
validators/
```

---

# 11. Utils

Location:

```text
utils/
```

Purpose:

```text
Pure helper functions
```

Examples:

```ts
formatDate()
```

```ts
generateRequestNumber()
```

```ts
calculateLeaveDuration()
```

---

Utils should know NOTHING about:

```text
database
leave approvals
students
```

---

# 12. lib/

This is the most misunderstood folder.

Purpose:

```text
Infrastructure
```

Examples:

```text
auth
db
api
errors
rbac
```

---

lib answers:

```text
How does the platform work?
```

---

services answer:

```text
How does the business work?
```

Huge difference.

---

# Mental Model

When writing code ask:

### Database structure?

```text
schema/
```

---

### Read/write database?

```text
repositories/
```

---

### Business process?

```text
services/
```

---

### Request validation?

```text
dto/
```

---

### Shared interfaces?

```text
types/
```

---

### Reusable validation?

```text
validators/
```

---

### Helper function?

```text
utils/
```

---

### Infrastructure?

```text
lib/
```

---

### API response?

```text
lib/api/
```

---

### Domain failure?

```text
lib/errors/
```

---

For your project, the next thing I would do is **clean up `create-leave.service.ts` using these ownership rules** before touching workflow. That file currently reveals where your boundaries are still blurry, and fixing it will make the rest of the system much easier to build correctly.
