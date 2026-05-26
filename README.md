# SST LeaveFlow

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue?logo=postgresql)
![Drizzle](https://img.shields.io/badge/ORM-Drizzle-orange)
![Node](https://img.shields.io/badge/Node-%E2%89%A518-green?logo=node.js)
![License](https://img.shields.io/badge/License-MIT-blue)
![Build](https://img.shields.io/badge/Build-passing-brightgreen)

</div>

---

# Project Overview

SST LeaveFlow is a unified institutional leave management and approval orchestration platform built for Scaler School of Technology.

The system manages:

* Hostel leaves
* College leaves
* Parent approvals
* POC approvals
* Admin workflows
* QR-based entry/exit tracking
* Vacation handling
* Group leaves
* Leave extensions
* Notification orchestration

The platform is designed as a configurable workflow engine rather than a hardcoded leave approval application, allowing future expansion into broader institutional operations.

Built with Next.js, TypeScript, PostgreSQL, and Drizzle ORM, the project emphasizes:

* scalable architecture
* workflow-driven approvals
* auditability
* role-based access control
* operational reliability
* extensibility for future institutional systems

---

# Core Features

## Leave Management

* Hostel leave workflows
* College leave workflows
* Dynamic leave categories
* Leave extensions
* Group leave support
* Vacation/stay requests
* Holiday-aware leave submission

---

## Approval Workflows

* Parent approvals via WhatsApp
* POC approvals
* Warden/Admin approvals
* Multi-step configurable workflows
* Cross-domain approval chains
* Workflow snapshots for audit consistency

---

## QR Verification System

* QR-based hostel exit/entry
* Scan validation
* Return tracking
* Overdue detection
* Mobile scanner support

---

## Notification System

* WhatsApp integration
* Slack integration
* Email notifications
* Google Sheets synchronization
* Retry-safe notification architecture

---

## Admin & Analytics

* Super admin dashboard
* Leave analytics
* Approval metrics
* Hostel occupancy insights
* Student leave history
* Audit logs

---

# Project Structure

```txt
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTION.md
│   ├── API.md
│   └── README.md
│
├── public/
│
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── admin/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── approvals/
│   │   │   │   ├── analytics/
│   │   │   │   ├── students/
│   │   │   │   └── scanner/
│   │   │   │
│   │   │   ├── poc/
│   │   │   │   ├── dashboard/
│   │   │   │   └── approvals/
│   │   │   │
│   │   │   ├── student/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── leave/
│   │   │   │   ├── history/
│   │   │   │   └── qr/
│   │   │   │
│   │   │   ├── super-admin/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── workflows/
│   │   │   │   ├── categories/
│   │   │   │   ├── users/
│   │   │   │   └── settings/
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── forgot-password/
│   │   │
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── leave-requests/
│   │   │   ├── approvals/
│   │   │   ├── qr/
│   │   │   ├── notifications/
│   │   │   ├── analytics/
│   │   │   ├── webhooks/
│   │   │   │   ├── whatsapp/
│   │   │   │   └── slack/
│   │   │   └── healthcheck/
│   │   │
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── forms/
│   │   ├── dashboard/
│   │   ├── approvals/
│   │   ├── qr/
│   │   └── analytics/
│   │
│   ├── db/
│   │   ├── drizzle/
│   │   ├── migrations/
│   │   ├── schema/
│   │   │   ├── auth.ts
│   │   │   ├── leave.ts
│   │   │   ├── workflow.ts
│   │   │   ├── qr.ts
│   │   │   ├── analytics.ts
│   │   │   └── notifications.ts
│   │   │
│   │   ├── index.ts
│   │   └── migrate.ts
│   │
│   ├── lib/
│   │   ├── auth/
│   │   ├── workflow-engine/
│   │   ├── notification/
│   │   ├── qr/
│   │   ├── analytics/
│   │   ├── policies/
│   │   ├── queues/
│   │   └── integrations/
│   │
│   ├── services/
│   │   ├── leave/
│   │   ├── workflow/
│   │   ├── notification/
│   │   ├── qr/
│   │   ├── audit/
│   │   └── analytics/
│   │
│   ├── hooks/
│   ├── providers/
│   ├── schema/
│   ├── types/
│   ├── utils/
│   └── middleware.ts
│
├── .env.example
├── components.json
├── drizzle.config.ts
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── tsconfig.json
└── next-env.d.ts
```

---

# Key Directories Explained

## `src/app/`

Next.js App Router pages and layouts.

### `(app)/`

Protected application routes:

* Student dashboard
* POC approvals
* Admin analytics
* QR scanner
* Workflow management

### `(auth)/`

Authentication pages:

* login
* forgot password

### `api/`

Backend API routes:

* leave submission
* approval workflows
* QR validation
* webhook integrations

---

## `src/lib/`

Core infrastructure and reusable logic.

| Folder             | Purpose                          |
| ------------------ | -------------------------------- |
| `workflow-engine/` | Approval orchestration engine    |
| `notification/`    | WhatsApp/Slack/email abstraction |
| `policies/`        | RBAC and permission rules        |
| `queues/`          | BullMQ background jobs           |
| `integrations/`    | External services                |

---

## `src/services/`

Business/domain logic layer.

Examples:

* leave lifecycle
* workflow transitions
* QR validation
* analytics aggregation

---

## `src/db/schema/`

Drizzle ORM schema definitions separated by domain.

| File               | Responsibility            |
| ------------------ | ------------------------- |
| `auth.ts`          | Users, roles, permissions |
| `leave.ts`         | Leave requests/categories |
| `workflow.ts`      | Workflow engine           |
| `qr.ts`            | QR sessions and scans     |
| `notifications.ts` | Delivery tracking         |

---

# System Architecture

SST LeaveFlow follows a modular domain-driven architecture.

## Core Domains

| Domain       | Responsibility         |
| ------------ | ---------------------- |
| Identity     | Auth + RBAC            |
| Leave        | Leave lifecycle        |
| Workflow     | Approval orchestration |
| Notification | WhatsApp/Slack/Email   |
| QR           | Entry/Exit validation  |
| Analytics    | Metrics + reporting    |
| Audit        | Immutable logs         |

---

# Workflow Architecture

Instead of hardcoding approval logic, SST LeaveFlow uses configurable workflow definitions.

Example:

```txt
Parent Approval
    ↓
POC Approval
    ↓
Warden Approval
    ↓
QR Generation
```

Each leave category can define:

* approval sequence
* required approvers
* notification channels
* escalation rules
* QR requirements

---

# Tech Stack

| Layer           | Technology         |
| --------------- | ------------------ |
| Framework       | Next.js 15         |
| Language        | TypeScript         |
| Database        | PostgreSQL         |
| ORM             | Drizzle ORM        |
| Styling         | Tailwind CSS       |
| UI Components   | shadcn/ui          |
| Validation      | Zod                |
| Authentication  | JWT                |
| Queue System    | BullMQ + Redis     |
| Email           | Resend             |
| Notifications   | Slack + WhatsApp   |
| File Storage    | S3 / Cloudflare R2 |
| Monitoring      | Sentry             |
| Package Manager | pnpm               |

---

# Getting Started

## Prerequisites

* Node.js 18+
* PostgreSQL
* Redis
* pnpm

---

# Quick Start

```bash
# Clone repository
git clone https://github.com/Scaler-Innovation-Labs/sst-leaveflow

cd sst-leaveflow

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env.local

# Start database migrations
pnpm db:migrate

# Seed initial data
pnpm db:seed

# Start development server
pnpm dev
```

---

# Environment Variables

```env
DATABASE_URL=

REDIS_URL=

JWT_SECRET=

RESEND_API_KEY=

SLACK_WEBHOOK_URL=

WHATSAPP_API_KEY=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

# Development Roadmap

## Phase 1

* Authentication
* RBAC
* Leave submission
* Basic workflows

## Phase 2

* Parent approvals
* Slack integration
* Email notifications
* QR generation

## Phase 3

* Scanner system
* Group leaves
* Extensions
* Analytics dashboard

## Phase 4

* College leave workflows
* Vacation management
* Advanced policies
* Workflow builder UI

---

# Future Scope

SST LeaveFlow is designed to evolve into a broader institutional workflow orchestration platform.

Potential future modules:

* Hostel complaints
* Attendance exceptions
* Gate passes
* Room transfers
* Discipline workflows
* Fee approvals
* Event permissions

---

# License

This project is licensed under the MIT License.

Copyright (c) 2026 SST LeaveFlow
