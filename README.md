# SST Hostel Leave System

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?logo=postgresql)
![Drizzle](https://img.shields.io/badge/ORM-Drizzle-orange)
![Clerk](https://img.shields.io/badge/Auth-Clerk-purple)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![Vitest](https://img.shields.io/badge/Tests-Vitest-green)
![pnpm](https://img.shields.io/badge/pkg-pnpm-yellow?logo=pnpm)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

# Project Overview

SST Hostel Leave System is a production-grade leave and movement management platform for Scaler School of Technology (SST) hostel operations.

The system manages:

- Leave requests and leave extensions
- Config-driven approval workflows (no hardcoded approval chains)
- Parent approvals via tokenized email/portal links
- QR-based hostel entry/exit tracking with a guard scanner
- Overdue leave detection and resolution
- Multi-channel notifications (SMS, email, Slack)
- Policy enforcement and dynamic leave forms
- Audit trails for every state transition

The platform is designed as a configurable workflow engine rather than a hardcoded leave approval application, allowing future expansion into broader institutional operations.

---

# Core Principles

- **Leave approval is not movement.** Permission (leave) and reality (movement) are independent systems — a student may have an approved leave while still inside the hostel.
- **Leave extensions are not new leaves.** Extending a leave always uses `leave_extensions`; a new leave request is never created.
- **Workflows are configuration-driven.** Approval chains are read from `workflow_definitions` / `workflow_steps`, never hardcoded (e.g. no `Parent → Warden` literals).
- **Forms are dynamic.** Leave type forms are driven by `leave_types.form_schema`; no database columns are added per form field.
- **QR represents authorization.** QR tokens only carry a token and identifier — never history.

---

# Core Features

## Leave Management

- Hostel leave workflows with dynamic leave categories
- Leave extensions (multi-step approval, QR window growth)
- Holiday-aware submission, dynamic forms, policy engine
- Vacation / stay requests, group leave support

## Approval Workflows

- Multi-step configurable approval chains per workflow definition
- Parent approvals via tokenized email/portal links
- POC / Admin / Super Admin approval queues
- Workflow snapshots for audit consistency, parent override flows

## QR Movement Tracking

- QR-based hostel exit/entry with scan validation
- Guard scanner UI (`@yudiel/react-qr-scanner`)
- Movement state machine (`IN_HOSTEL`, `OUTSIDE_HOSTEL`, ...)
- Overdue detection, overdue returns, QR expiry invalidation
- See `docs/movement-contract.md` for the full contract

## Notifications

- SMS via Infobip (India DLT compliant)
- Email via AWS SES with Resend fallback
- Slack bot alerts for staff (incl. POC-channel targeting)
- Provider abstraction, template engine, retry-safe delivery

## Reliability & Operations

- **Outbox pattern** for event-driven notification/audit delivery (DB-backed, no Redis)
- Vercel Cron jobs for outbox delivery, QR cleanup, and daily maintenance
- Audit logging on every state change; rate limiting
- Bounded batch processing for cron jobs

## Admin & Analytics

- Super Admin configuration: workflows, leave types, hostels, departments, academic groups, policies, notification rules/templates, users, parents, students
- Leave / movement / rejection analytics with occupancy insights
- Document uploads (Cloudinary) with MIME/size validation

---

# Architecture

## Layering

The codebase enforces a strict architectural flow:

```text
Route → DTO Validation → Service → Repository → Database
```

- **Routes** handle auth, authorization, validation, and response mapping only
- **DTOs** define Zod contracts for every externally supplied payload
- **Services** own workflows, approvals, notifications, policy evaluation, QR generation, and movement coordination
- **Repositories** are thin and own select/insert/update/delete only
- **Schema** files define persistence structure only

## Domains

```text
auth  academics  hostel  leave  movement  policy  notification  audit
```

Each domain owns its schema, repositories, services, and business rules. Cross-domain coupling is avoided.

## Event Pipeline

State changes publish events into an `outbox_events` table inside the same transaction. A cron-driven worker delivers them (notifications, QR scans, leave lifecycle events) with retries and crash recovery (`claimed_at` requeue).

---

# Project Structure

```txt
├── docs/                        Architecture & engineering documentation
├── scripts/                     Migrations (migrate-00XX.ts), seed & ops scripts
├── src/
│   ├── app/
│   │   ├── (auth)/              Clerk sign-in / redirect / sso-callback
│   │   ├── (dashboard)/         admin · guard · poc · student · super-admin · profile
│   │   ├── parent-approve/      Parent approval pages (tokenized links)
│   │   ├── api/v1/              REST API per domain (leaves, movements, qr, ...)
│   │   ├── api/cron/            Vercel cron endpoints (outbox, cleanup, maintenance)
│   │   └── api/webhooks/        Clerk webhooks
│   ├── components/              shadcn/ui primitives + shared components
│   ├── constants/               Enums & configuration constants
│   ├── db/
│   │   ├── schema/              Drizzle schema per domain
│   │   ├── repositories/        Thin data-access layer per domain
│   │   ├── seed/                Seed data (roles, workflows, leave types, ...)
│   │   └── drizzle/             Generated migrations
│   ├── dto/                     Zod contracts (request/response schemas)
│   ├── features/                Feature-scoped UI (components + hooks)
│   ├── hooks/                   Shared data hooks (SWR-based)
│   ├── lib/                     Infrastructure (auth, db, errors, api, messaging, crypto)
│   ├── providers/               React providers
│   ├── services/                Domain services (leave, movement, notification, outbox, ...)
│   ├── types/ · utils/
├── tests/                       Vitest suites
├── .env.example
├── AGENTS.md                    Engineering constitution for AI agents & contributors
├── drizzle.config.ts
├── vercel.json                  Cron schedules
└── package.json
```

---

# Tech Stack

| Layer             | Technology                                        |
| ----------------- | ------------------------------------------------- |
| Framework         | Next.js 16 (App Router)                           |
| Language          | TypeScript 5                                      |
| Database          | PostgreSQL (Neon serverless)                      |
| ORM               | Drizzle ORM                                       |
| Authentication    | Clerk (staff/student); parent approvals via tokenized links |
| Validation        | Zod 4                                             |
| Forms             | react-hook-form + zodResolver                     |
| Data Fetching     | SWR                                               |
| Styling           | Tailwind CSS 4                                    |
| UI Components     | shadcn/ui, lucide-react, recharts, sonner         |
| SMS               | Infobip (India DLT)                               |
| Email             | AWS SES (Resend fallback)                         |
| Chat              | Slack Bot API                                     |
| File Storage      | Cloudinary                                        |
| QR                | qrcode + @yudiel/react-qr-scanner                 |
| Background Jobs   | Outbox pattern + Vercel Cron (no Redis)           |
| Tests             | Vitest + Testing Library                          |
| Lint / Format     | ESLint 9, Prettier, husky, commitlint, lint-staged|
| Package Manager   | pnpm                                              |

---

# Getting Started

## Prerequisites

- Node.js 20.9+
- pnpm
- A PostgreSQL database (local or Neon)

## Quick Start

```bash
# Clone repository
git clone https://github.com/Scaler-Innovation-Labs/SST-Hostel-Leave.git

cd SST-Hostel-Leave

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env.local

# Apply database migrations in order
# (schema evolution is tracked via numbered scripts)
npx tsx scripts/migrate-0003.ts
# ... run each migrate-*.ts script up to the latest, e.g.:
npx tsx scripts/migrate-0023-rate-limit-entries.ts

# Seed initial data (roles, workflows, leave types, users, ...)
npx tsx scripts/clear-and-seed.ts

# Start the development server
pnpm dev
```

Migrations are standalone scripts under `scripts/` (`npx tsx scripts/migrate-00XX.ts`). Run them in numeric order against your database.

---

# Environment Variables

See `.env.example` for the full list with comments.

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Next.js auth secret
AUTH_SECRET=

# Clerk (authentication)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Email provider (ses | resend | sst)
EMAIL_PROVIDER=sst
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SES_FROM_EMAIL=
RESEND_API_KEY=

# SMS (Infobip)
INFOBIP_BASE_URL=https://api.infobip.com
INFOBIP_API_KEY=
INFOBIP_SENDER_ID=Scaler
INFOBIP_DLT_CONTENT_TEMPLATE_ID=
INFOBIP_DLT_PRINCIPAL_ENTITY_ID=
INFOBIP_CUSTOM_DOMAIN=

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL_ID=C1234567890
SLACK_POC_CHANNEL_ID=

# Cloudinary (document storage)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Cron jobs
CRON_SECRET=

# App settings
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOG_LEVEL=debug
```

---

# Cron Jobs

Defined in `vercel.json`:

| Endpoint             | Schedule    | Purpose                                        |
| -------------------- | ----------- | ---------------------------------------------- |
| `/api/cron/outbox`   | every 5 min | Deliver pending outbox events (retry-safe)     |
| `/api/cron/cleanup`  | every 6 hrs | QR pass expiry invalidation + audit logging    |
| `/api/cron/maintenance` | daily 03:00 | Maintenance: rate-limit pruning, reconciliation |

---

# Testing & Quality

```bash
pnpm test              # run tests once (Vitest)
pnpm test:watch        # watch mode
pnpm test:coverage     # coverage report
pnpm typecheck         # TypeScript type checking
pnpm lint              # ESLint
pnpm lint:fix          # ESLint with autofix
pnpm format            # Prettier
```

The suite covers services, repositories, routes, and state machines (153 test files, 871 tests). Commits are enforced with commitlint (conventional commits) and lint-staged via husky. The project also ships `pnpm audit:architecture` (see `scripts/audit-architecture.sh`).

---

# Documentation

- `docs/architecture/system-overview.md` — purpose, core principles, domain model
- `docs/architecture/leave-flow.md` — leave lifecycle
- `docs/architecture/movement-flow.md` — movement lifecycle
- `docs/movement-contract.md` — QR/movement contracts (T-series rules)
- `docs/architecture/domain-rules.md` — domain responsibilities and boundaries
- `docs/architecture/engineering-rules.md` — engineering conventions
- `docs/architecture/backend-development-workflow.md` — backend dev workflow
- `docs/architecture/code-review-checklist.md` — review checklist
- `docs/workflows.md` — config-driven workflow engine
- `docs/ui-system.md` — UI system and components
- `docs/folder-structure.md` — folder structure reference
- `docs/decisions.md` — architecture decisions
- `AGENTS.md` — engineering constitution (layering, naming, error handling, review rules)

---

# License

This project is licensed under the MIT License.

Copyright (c) 2026 SST Hostel Leave System