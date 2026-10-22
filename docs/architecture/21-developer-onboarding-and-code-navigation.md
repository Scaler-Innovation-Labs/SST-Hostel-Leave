# 21 — Developer Onboarding & Code Navigation Guide

**Purpose:** Comprehensive onboarding guide, codebase navigation cheat sheet, and step-by-step cookbook for making safe code modifications.  
**Audience:** New software engineers, interns, and code maintainers.  
**Status:** **IMPLEMENTED**

---

## 1. Local Environment Setup & Prerequisites

### Required Tools
* Node.js $\ge 20.x$ (LTS recommended)
* npm $\ge 10.x$ or pnpm
* PostgreSQL $\ge 15$ (or free Neon serverless connection string)
* Clerk Developer Account for authentication testing

### First-Time Local Bootstrap
```bash
# 1. Clone the repository and install dependencies
git clone https://github.com/sst/hostel-leave.git
cd SST-Hostel-Leave
npm install

# 2. Configure environment variables
cp .env.example .env.local
# Populate DATABASE_URL, CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# 3. Push schema migrations to local or Neon database
npx drizzle-kit push

# 4. Seed initial leave types, roles, and workflows
npx tsx src/db/seed/index.ts

# 5. Run the test suite to verify baseline health
npm test

# 6. Start local development server
npm run dev
# Server running at http://localhost:3000
```

---

## 2. Directory Navigation Map

```text
src/
├── app/                  # Next.js 16 App Router
│   ├── (auth)/           # Clerk sign-in / sign-up routes
│   ├── (dashboard)/      # Protected UI pages (student, admin, guard, poc)
│   ├── api/v1/           # REST Route Handlers (auth, leaves, movements, etc.)
│   ├── api/cron/         # Scheduled cleanup & maintenance cron handlers
│   └── parent-approve/   # Unauthenticated parent magic-link approval UI
├── components/           # Reusable React components & shadcn UI design system
├── constants/            # Domain enums, role hierarchy, event types
├── db/
│   ├── schema/           # Drizzle schema definitions (enums, leave, movement, auth)
│   └── repositories/     # Thin data-access layer (CRUD queries only)
├── dto/                  # Zod validation schemas and inferred types
├── lib/                  # Shared utilities (crypto, errors, db connection, logger)
├── services/             # Core business logic, workflows, policy engine, outbox
└── types/                # Shared TypeScript models and API interfaces
```

---

## 3. How to Follow a Feature Through the Code

When tracing any feature (e.g. Leave Submission), follow this exact chain:

```text
1. Route Handler:        src/app/api/v1/leaves/route.ts
                         └── Extracts Clerk session (requireAuth), extracts body
2. DTO Validator:        src/dto/leave/create-leave.dto.ts
                         └── Parses JSON through Zod (dates, fields, types)
3. Domain Service:       src/services/leave/create-leave.service.ts
                         └── Evaluates policies, opens db.transaction, acquires locks
4. Workflow Engine:      src/services/workflow/workflow-engine.ts
                         └── Resolves approval steps for the leave type
5. Repository:           src/db/repositories/leave/leave.repository.ts
                         └── Issues Drizzle SQL insert queries
6. Outbox Service:       src/services/outbox/outbox.service.ts
                         └── Atomically inserts outbox_events inside the transaction
7. Background Worker:    src/services/outbox/outbox-worker.service.ts
                         └── Drains queue and dispatches email/SMS
```

---

## 4. Developer Cookbook: How to Add a New Leave Type

To add a new leave type (e.g., **"Sports Event Leave"**):

### Step 1: Add Seed or Admin Form
In `src/db/seed/leave-types.seed.ts`, define the new record:
```ts
{
  code: "SPORTS_EVENT",
  name: "Sports Event Leave",
  category: "ACADEMIC",
  workflowMode: "ACADEMIC",
  defaultWorkflowCode: "POC_THEN_WARDEN",
  qrMode: "BOTH",
  allowExtensions: false,
  formSchema: {
    type: "object",
    required: ["tournamentName", "coachName"],
    properties: {
      tournamentName: { type: "string" },
      coachName: { type: "string" }
    }
  }
}
```

### Step 2: Configure Policy Rules (Optional)
If this leave type has a maximum duration:
In `src/db/seed/policies.seed.ts`, associate a `LIMIT` policy:
```ts
{
  name: "Sports Leave Max Days",
  policyType: "LIMIT",
  leaveTypeCode: "SPORTS_EVENT",
  config: { type: "MAX_DAYS", maxDays: 4 }
}
```

### Step 3: Verify Automated Tests
Run Vitest to verify that `createLeave()` respects the new type and form schema:
```bash
npm test tests/create-leave.service.spec.ts
```

---

## 5. Architectural Red Lines (Do Not Cross!)

1. **Never write raw SQL queries or Drizzle calls in Route Handlers.** Always invoke a Service.
2. **Never send external emails, SMS, or Slack alerts directly inside a Service.** Always write an event to `outboxService.publish(event, tx)`.
3. **Never use relative imports with parent traversal (`../../..`).** Always use `@/...`.
4. **Never throw `new Error('...')`.** Always throw domain errors: `NotFoundError`, `ValidationError`, `ConflictError`, or `AuthorizationError`.
5. **Never import Repositories from other Repositories.** Domain orchestration lives exclusively in Services.
