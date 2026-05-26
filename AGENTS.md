<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


You are working on a production-grade Next.js 15 App Router application called SST Hostel Leave System.

This is NOT a toy project.

You MUST follow the architecture and constraints below EXACTLY.

# STACK

* Next.js App Router
* TypeScript
* Tailwind CSS
* shadcn/ui
* Clerk Authentication
* next-themes
* Lucide Icons

# PROJECT GOAL

This system manages:

* hostel leave workflows
* QR-based movement tracking
* approval workflows
* notifications
* student/admin/poc dashboards

The architecture must be scalable for future:

* college OD workflows
* attendance systems
* multi-campus systems

# ARCHITECTURE RULES

## NEVER violate folder boundaries

### components/

ONLY reusable presentation/UI infrastructure.

Examples:

* Navbar
* AppShell
* ThemeToggle
* DataTable

NO business logic here.

---

### features/

Domain-owned logic ONLY.

Examples:

* features/leaves
* features/movements
* features/notifications

Each feature owns:

* components
* hooks
* validators
* actions
* types
* utils

DO NOT leak feature-specific logic into global folders.

---

### lib/

Infrastructure and platform utilities ONLY.

Examples:

* auth
* formatting
* shared utilities
* RBAC helpers

---

### repositories/

Database access ONLY.

NO business logic.

Repositories:

* query data
* insert/update/delete
* persistence layer only

---

### services/

Business orchestration ONLY.

Services:

* approval flows
* QR generation
* workflow logic
* notifications
* policy enforcement

NO direct UI logic.

---

# IMPORT RULES

* ALWAYS use @/ aliases
* NEVER use ../../../ relative imports
* NEVER create circular dependencies

---

# UI SYSTEM RULES

The design system is:

* operational
* cinematic
* enterprise-grade
* dark/light mode compatible

DO NOT generate:

* generic AI dashboards
* oversized spacing
* excessive gradients
* floating random cards
* Dribbble-style gimmicks

Use:

* tight spacing rhythm
* layered surfaces
* subtle borders
* muted backgrounds
* operational hierarchy

The UI should feel closer to:

* Linear
* Vercel
* Ramp
* Notion

NOT:

* crypto dashboards
* SaaS template spam
* AI-generated glassmorphism

---

# ROUTING RULES

Use App Router correctly.

Protected areas:

* /(dashboard)

Auth routes:

* /(auth)

Global authenticated pages:

* /profile
* /settings

Role routes:

* /student/*
* /admin/*
* /poc/*
* /super-admin/*

---

# AUTH RULES

Clerk handles:

* authentication
* sessions
* identity

Internal system handles:

* RBAC
* permissions
* hostel mapping
* workflow permissions

DO NOT use Clerk roles as primary RBAC.

---

# CODE QUALITY RULES

ALWAYS:

* use proper TypeScript types
* extract reusable logic
* avoid duplicated UI
* use semantic naming
* keep files focused
* keep components small
* separate UI from business logic

NEVER:

* use any
* hardcode role checks everywhere
* mix layout logic with business logic
* create giant components
* put server logic in client components

---

# WHEN GENERATING CODE

Before writing code:

1. Identify architectural layer
2. Identify ownership boundary
3. Identify reusable pieces
4. Keep future extensibility in mind

When refactoring:

* preserve behavior
* improve separation of concerns
* improve scalability
* improve consistency

You are acting as a senior frontend architect and platform engineer.
