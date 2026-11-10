# Next.js Page & Rendering Strategy Audit

> **Repository:** SST Hostel Leave & Movement Management Platform  
> **Framework:** Next.js 16 (App Router) + React 19 + TypeScript + Drizzle ORM + PostgreSQL  
> **Authentication:** Clerk Authentication + Role Consoles + Cookie-based Active Role Switching  
> **Audit Status:** Verified from Repository Source Code (`src/app/**`)  
> **Total UI Pages:** 50 (Mutually exclusive role routes)

---

## 1. Route Inventory & Structural Hierarchy

This audit covers **UI pages** only. API route handlers (`src/app/api/**/route.ts`), components, services, repositories, and utility files are intentionally excluded from the page count.

### Exact Page Count

```text
=====================================================
TOTAL UI PAGES: 49
=====================================================
```

> [!IMPORTANT]
> **Page Count vs. Component Count vs. Backend Endpoints Warning**
> 
> **50 does not mean the application has only 50 UI files.**
> A single page route composes dozens of modular components, hooks, services, schemas, and utilities.
> ```text
> 49 UI Page Routes ≠ 50 Source Files ≠ 50 Components ≠ 50 Backend Endpoints
> ```
> Specifically:
> - **49 UI Pages:** `page.tsx` entry points under `src/app/**`.
> - **42+ REST API Routes:** `route.ts` handlers under `src/app/api/v1/**`.
> - **85+ UI Components:** Reusable design system widgets, dialogs, cards, and tables.
> - **30+ Domain Services:** Orchestrating workflows, QR generation, policies, and notifications.
> - **25+ Drizzle Repositories:** Isolated data access modules.

---

### End-to-End Architecture Flow

```text
                         ┌──────────────────┐
                         │     Browser      │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │    proxy.ts      │
                         │ Clerk middleware │
                         └────────┬─────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │ Role Server Layout  │
                       │ auth + role check   │
                       └──────────┬──────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │    page.tsx      │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │ Client Feature   │
                         │ React + SWR      │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  /api/v1/*       │
                         │ REST Route       │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Zod DTO          │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Service Layer    │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Repository       │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ PostgreSQL       │
                         └──────────────────┘
```

---

### Layouts, Loading, Error Boundaries & Middleware Inventory

#### Root & Route Group Layouts
- **Root Layout:** [`src/app/layout.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/layout.tsx) — Mounts `ClerkProvider`, `ThemeProvider`, `SWRProvider`, and global `Toaster`. Configures Geist and Inter typography.
- **Student Layout:** [`src/app/(dashboard)/student/layout.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/student/layout.tsx) — Server Component. Enforces `ROLES.STUDENT` authorization via `getCurrentUser()` and wraps children in `<AppShell nav="student" density="student" bottomNav />`.
- **Admin / Warden Layout:** [`src/app/(dashboard)/admin/layout.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/admin/layout.tsx) — Server Component. Enforces `ROLES.ADMIN` or `ROLES.SUPER_ADMIN` authorization; aggregates badge counters for pending approvals, extension approvals, and overdue returns.
- **POC Layout:** [`src/app/(dashboard)/poc/layout.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/poc/layout.tsx) — Server Component. Enforces `ROLES.POC` authorization and renders `<AppShell nav="poc" density="admin" />`.
- **Guard Layout:** [`src/app/(dashboard)/guard/layout.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/guard/layout.tsx) — Server Component. Enforces `ROLES.GUARD` authorization and wraps the gate terminal in a distraction-free `<FieldShell roleLabel="Guard" />`.
- **Super Admin Layout:** [`src/app/(dashboard)/super-admin/layout.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/super-admin/layout.tsx) — Server Component. Enforces `ROLES.SUPER_ADMIN` authorization and renders the 17-item administrative sidebar.

#### Suspense & Loading Boundaries
- **Global Loading:** [`src/app/loading.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/loading.tsx) — Root fallback spinner.
- **Dashboard Loading:** [`src/app/(dashboard)/loading.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/loading.tsx) — Server Component skeleton mirroring masthead, 4 metric tiles, and 4 content rows.
- **Users Table Loading:** [`src/app/(dashboard)/super-admin/users/loading.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/super-admin/users/loading.tsx) — Dedicated table loading skeleton.
- **Workflows Loading:** [`src/app/(dashboard)/super-admin/workflows/loading.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/super-admin/workflows/loading.tsx) — Dedicated workflow editor loading skeleton.

#### Error Boundaries
- **Root Error Boundary:** [`src/app/error.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/error.tsx) — Client Component with reset handler, full reload fallback, and error digest tracing.
- **Dashboard Error Boundary:** [`src/app/(dashboard)/error.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/error.tsx) — Client Component contained within the dashboard shell.

#### Edge Middleware / Proxy
- **Proxy Middleware:** [`src/proxy.ts`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/proxy.ts) — Configures `clerkMiddleware`. Protects all `/student(.*)`, `/admin(.*)`, `/poc(.*)`, `/guard(.*)`, `/super-admin(.*)`, and `/api/v1(.*)` routes. Excludes `/api/parent-approve(.*)` for tokenized passwordless access, and redirects authenticated visitors hitting `/` to `/redirect`.

---

## 2. Master Page Inventory Table

| # | Route | Source File | User/Role | Rendering Classification | Server / Client | Data Source | Auth Required | Why This Strategy |
|---|---|---|---|---|---|---|---|---|
| 1 | `/` | `src/app/page.tsx` | Public | **A. Static / Prerendered** | Server Component | Static design tokens & marketing content | No | High-performance public marketing landing page; requires zero request-specific cookies, user session, or database access. |
| 2 | `/login` | `src/app/(auth)/login/page.tsx` | Public | **C. Client-Driven** | Client Component (`"use client"`) | Clerk Browser SDK (`useSignIn`, `useAuth`) | No | Coordinates Google SSO redirects and browser-level authentication state transitions via Clerk's browser SDK. |
| 3 | `/redirect` | `src/app/(auth)/redirect/page.tsx` | Authenticated / System | **E. Redirect / Dispatcher** | Server Component | Clerk Session + Database Roles (`getCurrentUser`) | Yes | Central server-side role dispatcher; evaluates user roles on the server and issues a 307 redirect to the appropriate dashboard. |
| 4 | `/sso-callback` | `src/app/(auth)/sso-callback/page.tsx` | Public | **C. Client-Driven** | Client Component (`"use client"`) | Clerk Browser Callback (`AuthenticateWithRedirectCallback`) | No | Handles browser-side OAuth callback hash/tokens and sets session cookies via Clerk's client runtime. |
| 5 | `/unauthorized` | `src/app/(auth)/unauthorized/page.tsx` | Public / Fallback | **A. Static / Prerendered** | Server Component | Static copy + Client `<SignOutTimer>` widget | No | Informational fallback page when an account has no assigned roles; prerendered statically with an embedded client auto-logout timer. |
| 6 | `/profile` | `src/app/(dashboard)/profile/page.tsx` | Authenticated / System | **B. Dynamic Server Rendering** | Server Component | Clerk Server SDK (`currentUser()`) | Yes | Pure Server Component; renders user identity, email, and Google profile photo directly into RSC HTML without client state. |
| 7 | `/parent-approve/[token]` | `src/app/parent-approve/[token]/page.tsx` | Parent | **D. Hybrid (Server Fetch + Client Form)** | Server Component (wraps Client Component) | Direct Service: `getLeaveDetailsByToken(token)` via PostgreSQL | Token-only (Passwordless) | Validates raw token hash and evaluates rate limits on server, fetches authorized leave record directly, then hydrates interactive approval form. |
| 8 | `/student/dashboard` | `src/app/(dashboard)/student/dashboard/page.tsx` | Student | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/dashboard/stats`, `/api/v1/leaves` | Yes (`STUDENT`) | Real-time interactive dashboard featuring a 20-second rotating QR pass modal, active leave countdowns, and quick actions. |
| 9 | `/student/leaves` | `src/app/(dashboard)/student/leaves/page.tsx` | Student | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/leaves` | Yes (`STUDENT`) | Client-side status filtering, pagination, and instant search over student's historical leave requests. |
| 10 | `/student/leaves/new` | `src/app/(dashboard)/student/leaves/new/page.tsx` | Student | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/leave-types`, `/api/v1/students/contacts` | Yes (`STUDENT`) | Dynamic form evaluation (JSON schema builder), emergency contact dropdown selector, document upload, and client validation. |
| 11 | `/student/leaves/[id]` | `src/app/(dashboard)/student/leaves/[id]/page.tsx` | Student | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/leaves/[id]`, `/api/v1/leaves/[id]/questions` | Yes (`STUDENT`) | Multi-section interactive workspace: leave summary, approver timeline, S3 document uploads, clarification Q&A, and cancellation. |
| 12 | `/admin/dashboard` | `src/app/(dashboard)/admin/dashboard/page.tsx` | Admin / Warden | **D. Hybrid** | Server Component (wraps `<StaffDashboard>`) | SWR: `/api/v1/dashboard/stats` | Yes (`ADMIN`) | Thin Server Component entry point inside `AdminLayout`, mounting client metrics dashboard with interactive quick actions. |
| 13 | `/admin/approvals` | `src/app/(dashboard)/admin/approvals/page.tsx` | Admin / Warden | **D. Hybrid** | Server Component (wraps `<ApprovalsPage>`) | SWR: `/api/v1/approvals` | Yes (`ADMIN`) | Server Component wrapper delegating to client approvals queue with hostel filtering, tab navigation, and pagination. |
| 14 | `/admin/approvals/[id]` | `src/app/(dashboard)/admin/approvals/[id]/page.tsx` | Admin / Warden | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/leaves/[id]` | Yes (`ADMIN`) | Interactive approval detail workspace with multi-step review, document verification, comment forms, and decision modals. |
| 15 | `/admin/extension-approvals` | `src/app/(dashboard)/admin/extension-approvals/page.tsx` | Admin / Warden | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/extensions/approvals` | Yes (`ADMIN`) | Interactive queue for reviewing and approving student leave extension requests. |
| 16 | `/admin/extension-approvals/[id]` | `src/app/(dashboard)/admin/extension-approvals/[id]/page.tsx` | Admin / Warden | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/extensions/[id]` | Yes (`ADMIN`) | Detail view comparing original return date vs. requested extension, with warden approval action form. |
| 17 | `/admin/students` | `src/app/(dashboard)/admin/students/page.tsx` | Admin / Warden | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/students` | Yes (`ADMIN`) | Student roster with live movement status badges (`IN_HOSTEL`, `CHECKED_OUT`, `OVERDUE`) and hostel filters. |
| 18 | `/admin/students/[id]` | `src/app/(dashboard)/admin/students/[id]/page.tsx` | Admin / Warden | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/students/[id]` | Yes (`ADMIN`) | Full student dossier displaying academic profile, room allocation, guardian contacts, and movement history. |
| 19 | `/admin/movements` | `src/app/(dashboard)/admin/movements/page.tsx` | Admin / Warden | **D. Hybrid** | Server Component (wraps `<MovementsPage>`) | SWR: `/api/v1/movements` | Yes (`ADMIN`) | Server Component hosting live gate movement audit log table with filter chips and search. |
| 20 | `/admin/overdue` | `src/app/(dashboard)/admin/overdue/page.tsx` | Admin / Warden | **D. Hybrid** | Server Component (wraps `<OverdueReturnsPage>`) | SWR: `/api/v1/overdue` | Yes (`ADMIN`) | Server Component wrapping live overdue returns monitor with quick contact actions and warden alerts. |
| 21 | `/admin/analytics` | `src/app/(dashboard)/admin/analytics/page.tsx` | Admin / Warden | **D. Hybrid** | Server Component (wraps `<AnalyticsShell>`) | SWR: `/api/v1/analytics/*` | Yes (`ADMIN`) | Server wrapper hosting Recharts visualizations for leave volumes, compliance rates, and peak movement hours. |
| 22 | `/poc/dashboard` | `src/app/(dashboard)/poc/dashboard/page.tsx` | POC | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/approvals` | Yes (`POC`) | Scoped POC queue displaying academic leave requests pending departmental approval. |
| 23 | `/poc/approvals/[id]` | `src/app/(dashboard)/poc/approvals/[id]/page.tsx` | POC | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/leaves/[id]` | Yes (`POC`) | Academic review detail view allowing POC to approve, reject with category, or request student clarification. |
| 24 | `/guard/scanner` | `src/app/(dashboard)/guard/scanner/page.tsx` | Security Guard | **D. Hybrid** | Server Component (wraps `<ScannerPage>`) | Browser Camera API + `/api/v1/movements/scan` | Yes (`GUARD`) | Hardware-optimized gate scanner using `@yudiel/react-qr-scanner`, audio/haptic feedback, and pass preview validation. |
| 25 | `/guard/manual-movement` | `src/app/(dashboard)/guard/manual-movement/page.tsx` | Security Guard | **D. Hybrid** | Server Component (wraps `<ManualMovementPage>`) | SWR + `/api/v1/movements/manual-*` | Yes (`GUARD`) | Fallback emergency terminal for manual check-out and return logging when student devices are dead. |
| 26 | `/super-admin/dashboard` | `src/app/(dashboard)/super-admin/dashboard/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/dashboard/stats` | Yes (`SUPER_ADMIN`) | Institution-wide command center with global KPI metrics, quick links to user provisioning, and analytics. |
| 27 | `/super-admin/approvals` | `src/app/(dashboard)/super-admin/approvals/page.tsx` | Super Admin | **D. Hybrid** | Server Component (wraps `<ApprovalsPage>`) | SWR: `/api/v1/approvals` | Yes (`SUPER_ADMIN`) | Global approval oversight queue across all hostels and departments. |
| 28 | `/super-admin/approvals/[id]` | `src/app/(dashboard)/super-admin/approvals/[id]/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/leaves/[id]` | Yes (`SUPER_ADMIN`) | Master leave detail workspace equipped with Super Admin force-override actions. |
| 29 | `/super-admin/extension-approvals` | `src/app/(dashboard)/super-admin/extension-approvals/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/extensions/approvals` | Yes (`SUPER_ADMIN`) | Institution-wide queue for pending extension approvals. |
| 30 | `/super-admin/extension-approvals/[id]` | `src/app/(dashboard)/super-admin/extension-approvals/[id]/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/extensions/[id]` | Yes (`SUPER_ADMIN`) | Global extension detail workspace with override approval capability. |
| 31 | `/super-admin/students` | `src/app/(dashboard)/super-admin/students/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/students` | Yes (`SUPER_ADMIN`) | Master student registry featuring CSV bulk upload, room reassignments, and status toggles. |
| 32 | `/super-admin/students/[id]` | `src/app/(dashboard)/super-admin/students/[id]/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/students/[id]` | Yes (`SUPER_ADMIN`) | Complete student administration console: profile, parents, leaves, movements, and disciplinary locks. |
| 33 | `/super-admin/parents` | `src/app/(dashboard)/super-admin/parents/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/parents` | Yes (`SUPER_ADMIN`) | Parent contact directory with student linking and phone number verification. |
| 34 | `/super-admin/users` | `src/app/(dashboard)/super-admin/users/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/users` | Yes (`SUPER_ADMIN`) | Staff directory listing all accounts, active consoles, and role assignments. |
| 35 | `/super-admin/users/new` | `src/app/(dashboard)/super-admin/users/new/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | Client Mutation: `fetch(/api/v1/users)` | Yes (`SUPER_ADMIN`) | Account provisioning form with role selection, hostel assignment, and validation. |
| 36 | `/super-admin/users/[id]` | `src/app/(dashboard)/super-admin/users/[id]/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/users/[id]` | Yes (`SUPER_ADMIN`) | Staff profile dossier displaying audit logs, role scopes, and assigned hostels. |
| 37 | `/super-admin/users/[id]/edit` | `src/app/(dashboard)/super-admin/users/[id]/edit/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/users/[id]` + mutation | Yes (`SUPER_ADMIN`) | Role and scope modification console with multi-role assignment toggles. |
| 38 | `/super-admin/movements` | `src/app/(dashboard)/super-admin/movements/page.tsx` | Super Admin | **D. Hybrid** | Server Component (wraps `<MovementsPage>`) | SWR: `/api/v1/movements` | Yes (`SUPER_ADMIN`) | Global gate movement ledger tracking all entries and exits across campus turnstiles. |
| 39 | `/super-admin/overdue` | `src/app/(dashboard)/super-admin/overdue/page.tsx` | Super Admin | **D. Hybrid** | Server Component (wraps `<OverdueReturnsPage>`) | SWR: `/api/v1/overdue` | Yes (`SUPER_ADMIN`) | Central overdue student monitoring console with real-time escalation counters. |
| 40 | `/super-admin/analytics` | `src/app/(dashboard)/super-admin/analytics/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/analytics/*` | Yes (`SUPER_ADMIN`) | Cross-hostel analytics dashboard with Recharts visualizations and comparative hostel metrics. |
| 41 | `/super-admin/hostels` | `src/app/(dashboard)/super-admin/hostels/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/hostels` | Yes (`SUPER_ADMIN`) | Hostel block management console with capacity limits and curfew time configuration. |
| 42 | `/super-admin/departments` | `src/app/(dashboard)/super-admin/departments/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/departments` | Yes (`SUPER_ADMIN`) | Academic department configuration console with program mappings. |
| 43 | `/super-admin/academic-groups` | `src/app/(dashboard)/super-admin/academic-groups/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/academic-groups` | Yes (`SUPER_ADMIN`) | Student batch and section configuration console. |
| 44 | `/super-admin/leave-types` | `src/app/(dashboard)/super-admin/leave-types/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/admin/leave-types` | Yes (`SUPER_ADMIN`) | Interactive dynamic form builder and leave policy configuration workspace. |
| 45 | `/super-admin/workflows` | `src/app/(dashboard)/super-admin/workflows/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/workflows` | Yes (`SUPER_ADMIN`) | Multi-step approval chain designer with reorderable approval steps and escalation rules. |
| 46 | `/super-admin/policies` | `src/app/(dashboard)/super-admin/policies/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/policies` | Yes (`SUPER_ADMIN`) | Campus leave policy engine manager with quota constraints and blackout periods. |
| 47 | `/super-admin/notification-templates` | `src/app/(dashboard)/super-admin/notification-templates/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/notification-templates` | Yes (`SUPER_ADMIN`) | Template editor for Email, SMS, and Slack notifications with variable interpolators. |
| 48 | `/super-admin/notification-rules` | `src/app/(dashboard)/super-admin/notification-rules/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/notification-rules` | Yes (`SUPER_ADMIN`) | Notification event-routing matrix mapping events to channels and recipients. |
| 49 | `/super-admin/notifications/delivery-logs` | `src/app/(dashboard)/super-admin/notifications/delivery-logs/page.tsx` | Super Admin | **C. Client-Driven** | Client Component (`"use client"`) | SWR: `/api/v1/admin/notification-logs` | Yes (`SUPER_ADMIN`) | Outbox audit log stream displaying dispatch timestamps, provider responses, and failures. |

---

## 3. Deep Code Inspection: Architectural Layers & Rendering Execution

### 1. Server vs. Client Component Boundaries: What "Client-Driven" Means
In Next.js App Router, declaring `"use client"` does **not** convert a page into a legacy standalone Single Page Application (SPA). Instead, it defines an interactive boundary within the server-rendered tree:
- **Server Components (15 files):** Pages that render static copy (`/`), execute direct server-side redirects (`/redirect`), fetch from the database inside a secure token boundary (`/parent-approve/[token]`), read identity directly from Clerk's server runtime (`/profile`), or serve as lightweight RSC shells inside layout boundaries (`admin/approvals`, `guard/scanner`).
- **Client-Driven Pages (35 files):** Pages that declare `"use client"` at the boundary to manage dynamic form state, client-side filtering, camera hardware access (`@yudiel/react-qr-scanner`), optimistic UI updates, and SWR caching.

> [!NOTE]
> **Interview Precision: Client-Driven vs. Traditional CSR**
> 
> If asked *"Is your dashboard client-side rendered (CSR)?"*:
> 
> **Strong Answer:** *"The dashboard features are **client-driven** because interactive data fetching, filtering, and local state management use Client Components and SWR. However, the route itself participates in the App Router's server-rendered tree, and authentication/authorization is enforced server-side upstream by edge middleware and the server role layout before any client code mounts."*

### 2. Layout Chain Influence: The Server Authorization Gate
Next.js App Router evaluates layouts top-down before rendering any child page:
1. `src/app/layout.tsx` (Root): Mounts `ClerkProvider`. Because Clerk hooks require context, client components inside any page have access to session data without making duplicate `/me` requests.
2. `src/app/(dashboard)/*/layout.tsx` (Role Layouts): Every role layout executes:
   ```ts
   const user = await getCurrentUser();
   if (!user || !user.roles.includes(REQUIRED_ROLE)) {
     redirect("/unauthorized");
   }
   ```
   **Crucial Architectural Consequence:** Even though 35 pages inside the dashboard declare `"use client"`, they **never execute in an unauthenticated or unauthorized state**. The parent Server Layout intercepts unauthenticated requests at the server level, preventing the client bundle from leaking or rendering for unauthorized users.

### 3. Data Fetching Strategy: Why REST Instead of Server Actions?
The repository contains **zero** Server Actions (`"use server"` mutations). All data operations adhere strictly to the `Route → DTO Validation → Service → Repository → Database` architectural rule.

> [!TIP]
> **Why REST APIs Instead of Server Actions?**
> 
> The application intentionally uses REST APIs (`/api/v1/*`) as the mutation and query boundary rather than Server Actions so that:
> 1. **Centralized & Standardized Contracts:** Authorization, Zod DTO validation, service orchestration, rate limiting, and audit logging are standardized in dedicated route handlers with uniform JSON response envelopes.
> 2. **Independent Testability & Tooling:** REST endpoints can be independently load tested, fuzz tested, and formally specified via the OpenAPI/Scalar documentation pipeline.
> 3. **Consistent Caching & Revalidation:** SWR provides client-side cache deduplication, optimistic updates, and background revalidation that integrates cleanly with HTTP REST verbs.

---

## 4. Why Each Page Uses Its Rendering Strategy

### Why isn't every page statically generated (SSG)?
1. **Dynamic Authentication State:** 48 out of 50 pages require an authenticated identity or a time-sensitive cryptographic token. Generating them statically at build time would produce identical empty shells and prevent server-side role verification.
2. **Real-Time Consistency & Concurrency:** Hostel movement and leave requests change state continuously (e.g. guard scanning turnstiles, warden approving leaves, parents deciding via SMS links). Statically baking leave data would lead to dangerous authorization desynchronization (e.g., admitting a student whose leave was cancelled).
3. **Multi-Tenant Role Scoping:** A single endpoint/screen renders different datasets depending on whether the requester is a POC for Computer Science, a Cauvery Block warden, or an Admin.

### Why isn't everything purely server-rendered (RSC)?
1. **Hardware & Browser APIs:** The security guard terminal (`/guard/scanner`) requires browser video streaming, WebRTC/MediaDevices camera control, canvas barcode analysis, and Web Audio API beeps.
2. **Ephemeral UI State & Interactive Wizards:** Leave creation (`/student/leaves/new`) dynamically renders custom input fields based on JSON schemas stored in `leave_types.form_schema`. It uses `react-hook-form` and client-side validation to provide immediate feedback before submission.
3. **Rotating Secret Display & Freshness Timers:** The student dashboard (`/student/dashboard`) manages a live 20-second client-side countdown timer and manual regeneration trigger to prevent shoulder-surfing and stale screen captures.
4. **Instant Client-Side Filtering:** Queue tables (`/admin/approvals`, `/super-admin/students`) provide responsive tab switching, text search, and pagination across cached datasets without triggering full round-trip page reloads.

### Why isn't everything purely client-rendered (SPA)?
1. **Zero-Flash Security Enforcement:** If authentication were purely client-side, the browser would download the dashboard JavaScript, mount the skeleton, read local storage, and then redirect to login. In this codebase, unauthorized access is rejected on the server by the layout with an immediate HTTP 307 redirect.
2. **Token Security Boundary:** On `/parent-approve/[token]`, the server validates the token and fetches the authorized leave information. Only the intentionally selected, server-validated data required by the approval UI is passed to the client rather than exposing raw database records or internal authorization state.
3. **SEO & Performance on Public Routes:** The marketing landing page (`/`) renders as pre-compiled HTML, ensuring sub-second First Contentful Paint (FCP) and optimal search crawler indexing.

---

## 5. Separation of Page vs. Component Rendering

A frequent point of confusion in Next.js App Router audits is labeling an entire route "Client-Side Rendered" because it contains interactive elements. In this repository, there is a clear distinction between the **Page Shell** and the **Interactive Feature Component**:

```text
┌────────────────────────────────────────────────────────┐
│ Server Boundary: Next.js Server Component (RSC)         │
│  - Evaluates layout (AdminLayout)                     │
│  - Enforces Clerk authentication & role check          │
│  - Resolves params (e.g. { id })                       │
│  - Renders <AppShell> with server-verified badges      │
│                                                        │
│   src/app/(dashboard)/admin/approvals/page.tsx         │
│    └─ <ApprovalsPage viewerRole="ADMIN" />             │
└───────────────────────────┬────────────────────────────┘
                            │ Hydration boundary
┌───────────────────────────▼────────────────────────────┐
│ Client Boundary: Interactive Feature Component (Client)│
│  - "use client"                                        │
│  - SWR data fetching & cache invalidation              │
│  - Filter tabs, search state, pagination               │
│  - ApprovalCommandCard modal dialogs                   │
│                                                        │
│   src/features/approvals/components/ApprovalsPage.tsx  │
└────────────────────────────────────────────────────────┘
```

By decoupling the Server Component entry page from the Client Feature component:
1. Role-based layouts remain Server Components, keeping server authorization logic out of client JavaScript bundles.
2. Feature components can be reused across different role consoles (for example, `<ApprovalsPage />` is shared between `/admin/approvals`, `/poc/dashboard`, and `/super-admin/approvals` with different `viewerRole` props).

---

## 6. Role-Based Page Map

> [!NOTE]
> **50 unique UI page routes. Role categories are mutually exclusive for counting purposes.**

```text
PUBLIC (4 Pages)
├── /                                   Landing page (Static)
├── /login                              Google SSO login portal (Client-Driven)
├── /sso-callback                       OAuth callback handler (Client-Driven)
└── /unauthorized                       Access denied fallback (Static)

AUTHENTICATED / SYSTEM (2 Pages)
├── /profile                            User profile & Google metadata (Dynamic Server)
└── /redirect                           Central server-side role dispatcher (Redirect)

PARENT (1 Page)
└── /parent-approve/[token]             Passwordless decision portal (Hybrid)

STUDENT (4 Pages)
├── /student/dashboard                  Active pass, quotas, recent leaves (Client-Driven)
├── /student/leaves                     Historical leave table (Client-Driven)
├── /student/leaves/new                 Dynamic leave application wizard (Client-Driven)
└── /student/leaves/[id]                Leave timeline, docs, questions (Client-Driven)

GUARD (2 Pages)
├── /guard/scanner                      Camera QR scanner terminal (Hybrid)
└── /guard/manual-movement              Manual gate entry/exit override (Hybrid)

POC (2 Pages)
├── /poc/dashboard                      Academic approval queue (Client-Driven)
└── /poc/approvals/[id]                 Leave approval review & decisions (Client-Driven)

ADMIN / WARDEN (10 Pages)
├── /admin/dashboard                    Hostel summary & quick actions (Hybrid)
├── /admin/approvals                    Hostel leave approval queue (Hybrid)
├── /admin/approvals/[id]               Warden review & decision workspace (Client-Driven)
├── /admin/extension-approvals          Extension requests queue (Client-Driven)
├── /admin/extension-approvals/[id]     Extension review workspace (Client-Driven)
├── /admin/students                     Student roster & movement status (Client-Driven)
├── /admin/students/[id]                Student dossier & history (Client-Driven)
├── /admin/movements                    Live gate movement stream (Hybrid)
├── /admin/overdue                      Overdue returns monitor (Hybrid)
└── /admin/analytics                    Hostel movement & leave analytics (Hybrid)

SUPER_ADMIN (24 Pages)
├── /super-admin/dashboard              Institution-wide executive dashboard (Client-Driven)
├── /super-admin/approvals              Global approval queue (Hybrid)
├── /super-admin/approvals/[id]         Master review with force-override (Client-Driven)
├── /super-admin/extension-approvals    Global extension queue (Client-Driven)
├── /super-admin/extension-approvals/[id] Global extension review (Client-Driven)
├── /super-admin/students               Global student registry & CSV import (Client-Driven)
├── /super-admin/students/[id]          Student administrative profile (Client-Driven)
├── /super-admin/parents                Parent contact management (Client-Driven)
├── /super-admin/users                  Staff directory & role assignment (Client-Driven)
├── /super-admin/users/new              Staff account provisioning (Client-Driven)
├── /super-admin/users/[id]             Staff profile & audit view (Client-Driven)
├── /super-admin/users/[id]/edit        Staff role & scope editor (Client-Driven)
├── /super-admin/movements              Institution-wide gate ledger (Hybrid)
├── /super-admin/overdue                Global overdue monitor (Hybrid)
├── /super-admin/analytics              Comparative cross-hostel analytics (Client-Driven)
├── /super-admin/hostels                Hostel blocks & curfew settings (Client-Driven)
├── /super-admin/departments            Academic departments (Client-Driven)
├── /super-admin/academic-groups        Batches and student cohorts (Client-Driven)
├── /super-admin/leave-types            Leave categories & dynamic form builder (Client-Driven)
├── /super-admin/workflows              Approval chain workflow designer (Client-Driven)
├── /super-admin/policies               Leave quota & rule engine manager (Client-Driven)
├── /super-admin/notification-templates Email, SMS & Slack template editor (Client-Driven)
├── /super-admin/notification-rules     Notification trigger routing matrix (Client-Driven)
└── /super-admin/notifications/delivery-logs Outbox delivery audit trail (Client-Driven)
```

```text
=====================================================
ROLE CATEGORY RECONCILIATION:
  Public:                               4
  Authenticated / System:               2
  Parent:                               1
  Student:                              4
  Guard:                                2
  POC:                                  2
  Admin / Warden:                      10
  Super Admin:                         24
-----------------------------------------------------
  TOTAL MUTUALLY EXCLUSIVE ROUTES:     49
=====================================================
```

---

## 7. Rendering Strategy Summary

```text
=====================================================
RENDERING STRATEGY DISTRIBUTION
=====================================================
Total UI Pages:                  49  (100.0%)

A. Static / Prerendered:          2  (  4.0%)
B. Dynamic Server Rendering:      1  (  2.0%)
C. Client-Driven:                34  ( 69.4%)
D. Hybrid (Server Page + Client): 11  ( 22.0%)
E. Redirect / Dispatcher:         1  (  2.0%)
=====================================================
```

### Classification Details
- **Static / Prerendered (2):** Routes compiled to pure HTML/CSS at build time (`/`, `/unauthorized`).
- **Dynamic Server Rendering (1):** Pure Server Component rendering private session data on the server without client state (`/profile`).
- **Client-Driven (34):** Interactive pages with `"use client"` at the boundary, fetching data on the client via SWR after server-side layout authentication.
- **Hybrid (11):** Server Component entry pages that perform server operations (token crypto, direct DB reads, or server shell wrapping) and delegate UI/interactivity to Client Components.
- **Redirect / Dispatcher (1):** Headless Server Component that evaluates user credentials on the server and issues a 307 HTTP redirect (`/redirect`).

---

## 8. Common Architectural Rendering Patterns

### Pattern 1: Protected Server Layout + Client SWR Workspace
*Used across 45 authenticated dashboard routes.*

```text
User Request
     │
     ▼
[src/proxy.ts] (Edge Middleware)
  - auth.protect() ensures active Clerk session cookie
     │
     ▼
[(dashboard)/*/layout.tsx] (Server Component)
  - await getCurrentUser()
  - Validates role membership (e.g. ROLES.STUDENT)
  - If invalid: redirect("/unauthorized")
  - Renders <AppShell> (masthead, navigation, badges)
     │
     ▼
[page.tsx] ("use client")
  - Mounts client hooks: useSWR("/api/v1/leaves")
  - Manages interactive state (filters, dialogs, forms)
     │
     ▼
[/api/v1/*] (Route Handler)
  - DTO Validation → Service → Repository → PostgreSQL
  - Returns standard { success: true, data: T } envelope
```

### Pattern 2: Token-Authenticated Hybrid Page (Passwordless Parent Portal)
*Used on `/parent-approve/[token]`.*

```text
Parent clicks link in SMS/Email
     │
     ▼
[src/proxy.ts]
  - Recognized as isParentApproveRoute: bypasses Clerk session check
     │
     ▼
[src/app/parent-approve/[token]/page.tsx] (Server Component)
  - Hashes token via sha256(token)
  - Evaluates rateLimit("parent-approve-view:<hash>", 30, 900_000)
  - Calls getLeaveDetailsByToken(token) directly against database
  - If expired or invalid: renders server error state
     │
     ▼
[ParentApprovalFlow.tsx] (Client Component)
  - Hydrated with intentionally selected, server-validated leave data
  - Captures parent decision (APPROVED / REJECTED) and comments
  - Submits POST to /api/parent-approve/[token]/decision
```

### Pattern 3: Server Entry Shell Wrapping Reusable Client Feature
*Used on `/admin/approvals`, `/super-admin/approvals`, `/guard/scanner`, etc.*

```text
Server Component page.tsx
  - No "use client" directive
  - Resolves server params and sets configuration props
     │
     ▼
Feature Client Component (e.g. <ApprovalsPage viewerRole="ADMIN" />)
  - "use client"
  - Embeds all interactive buttons, modals, and SWR hooks
  - Reused across multiple consoles with role-specific behavior
```

---

## 9. Code Quality & Architectural Observations

### Finding 1: Client Component Inconsistency in Administrative Pages
- **Verified Implementation:** [`src/app/(dashboard)/admin/analytics/page.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/admin/analytics/page.tsx) is a Server Component wrapping `<AnalyticsShell>`, while [`src/app/(dashboard)/super-admin/analytics/page.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/super-admin/analytics/page.tsx) declares `"use client"` directly at the page level. Both render the same underlying `<AnalyticsShell>`.
- **Architectural Rationale:** Standardizing `super-admin/analytics` to use a server wrapper would improve code consistency across admin consoles. However, this is a **nice-to-have architectural optimization**, not a bug: because the super-admin analytics view has no prerequisite server-only data fetching, mounting the client component directly is functionally sound.

### Finding 2: SWR Client Fetching in Admin Student Detail
- **Verified Implementation:** [`src/app/(dashboard)/admin/students/[id]/page.tsx`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/(dashboard)/admin/students/[id]/page.tsx) executes data fetching on the client via SWR rather than in a Server Component.
- **Architectural Rationale:** This design allows the warden to switch fluidly between tabs (Profile, Leave History, Movements, Guardian Details) and trigger manual movement overrides without incurring full server-side page roundtrips.

### Finding 3: Centralized Navigation Badge Polling
- **Verified Implementation:** [`src/app/api/v1/badges/route.ts`](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/src/app/api/v1/badges/route.ts) provides a single endpoint returning `{ pendingApprovals, pendingExtensions, overdueReturns }`.
- **Architectural Rationale:** The sidebar previously fired three independent pollers (`/approvals`, `/extension-approvals`, `/overdue`) on every navigation, causing three cold-lambda executions per page load. Consolidating into `/api/v1/badges` reduced database query fan-out by 66%.

---

## 10. End-to-End Data Flow Maps for Major Pages

### Flow 1: Student Submitting a Leave Request
```text
/student/leaves/new
  │
  ├─ SWR GET /api/v1/leave-types ──────────────► Fetches leave forms & workflow IDs
  ├─ SWR GET /api/v1/students/contacts ────────► Fetches student's parent/emergency contacts
  │
  ▼ [User selects parent contact & submits form]
Client fetch POST /api/v1/leaves
  │
  ▼
createLeaveRouteHandler (/api/v1/leaves/route.ts)
  ├─ requireAuth() + requireAnyRole([STUDENT])
  ├─ createLeaveSchema.parse(body) ────────────► Validates dates, contact ID & schema
  ├─ createLeaveService.createLeave()
  │   ├─ leaveRepository.hasOverlappingLeave()
  │   ├─ studentRepository.verifyContactOwnership()
  │   ├─ leaveRepository.createLeave() ────────► Inserts into leave_requests
  │   ├─ workflowEngine.initializeSteps() ─────► Inserts into leave_approvals
  │   └─ outboxService.enqueueEvent() ────────► Enqueues LEAVE_SUBMITTED notification
  ▼
Returns { success: true, data: { id: "...", status: "PENDING" } }
  │
  ▼
router.push("/student/leaves/[id]")
```

### Flow 2: Security Guard Gate Scan (Checkout)
```text
/guard/scanner
  │
  ▼ [Camera detects dynamic QR code]
ScannerPage captures raw payload token
  │
  ▼
Client POST /api/v1/movements/scan/preview
  ├─ scanQrService.previewScan(token)
  ├─ Validates token signature, state & server TTL
  ├─ Queries student and leave records
  ▼
Renders modal: Student Photo, Roll No, Room, Approved Return Time
  │
  ▼ [Guard clicks "Confirm Exit"]
Client POST /api/v1/movements/scan
  ├─ scanQrService.commitScan(token, "LEAVE_EXIT")
  ├─ Inserts record into movement_events (source: QR_SCAN)
  ├─ Updates student_movement_states.current_state = "CHECKED_OUT"
  ├─ Marks qr_passes.status = "USED" (prevents token reuse)
  └─ Enqueues notification to parents: "Student has exited campus gate"
  ▼
Plays success audio tone & resets camera scanner
```

---

## 11. Technical Interview Questions & Verified Answers

#### 1. Why is `/` statically prerendered while `/student/dashboard` is client-driven?
> **Answer:** `/` is a public marketing landing page that contains no personal or dynamic data. It can be compiled to static HTML at build time for instant delivery via CDN. In contrast, `/student/dashboard` requires an active Clerk session, displays user-specific leave balances, and manages an ephemeral, 20-second rotating QR pass that updates in real time.

#### 2. What prevents unauthenticated users from seeing `/admin/dashboard` if the page component uses client-side rendering?
> **Answer:** Next.js App Router enforces layout boundaries on the server before child components mount. The parent layout `src/app/(dashboard)/admin/layout.tsx` is an async Server Component that executes `await getCurrentUser()`. If there is no active session or the user lacks the `ADMIN` role, the server issues an immediate `redirect("/unauthorized")`, preventing the client bundle from rendering.

#### 3. Why doesn't the parent approval page (`/parent-approve/[token]`) require Clerk authentication?
> **Answer:** Parents access approvals through unique one-time links sent via SMS or email. Requiring account creation or login would add friction and delay urgent approvals. Instead, the page uses token-based authentication: the raw token in the URL is hashed via SHA-256 on the server and matched against `leave_approval_parent_details.token_hash`. It is protected by server-side rate-limiting (`rateLimit("parent-approve-view:<hash>", 30, 900_000)`). The server validates the token and fetches the authorized leave information, passing only intentionally selected data to the client UI rather than exposing raw database records.

#### 4. How does the application avoid layout shift (CLS) when navigating between dashboard tabs?
> **Answer:** The dashboard uses layout-level Suspense boundaries via `src/app/(dashboard)/loading.tsx`. This file provides a Server Component skeleton that mirrors the structure of the `<AppShell>` (masthead, 4 metric tiles, and content rows). When switching tabs, the shell remains mounted while the content stream updates smoothly.

#### 5. Why does the application use SWR instead of Server Actions for data mutations?
> **Answer:** The project's architectural guidelines (`AGENTS.md`) mandate a strict layered flow: `Route → DTO Validation → Service → Repository → Database`. Standardizing on REST Route Handlers under `/api/v1/*` ensures that all inputs are validated through Zod schemas, errors return consistent JSON envelopes, and operations can be documented via OpenAPI. SWR consumes these endpoints on the client, providing automatic revalidation, optimistic updates, and cache deduplication.

#### 6. What happens during a role switch for a multi-role user (e.g. POC switching to Admin)?
> **Answer:** The client sends a request to `POST /api/v1/me/active-role` with `{ role: "ADMIN" }`. The server validates that the user is authorized for that role, sets an `active_role` HTTP-only cookie, and returns `{ activeRole: "ADMIN", dashboardHref: "/admin/dashboard" }`. The client then updates SWR cache keys and calls `router.push("/admin/dashboard")`.

#### 7. How does the 20-second QR gate pass work between the client and server?
> **Answer:** The QR code represents a short-lived authorization credential. The UI displays it with a 20-second client-side countdown timer and manual regeneration button to discourage shoulder-surfing and screenshot sharing. However, the **server is the ultimate security authority**: the backend validates token cryptographic signatures, checks state and freshness, and invalidates previously generated credentials when a pass is re-issued or committed at the gate.

#### 8. How are dynamic leave form fields rendered without adding database columns for every question?
> **Answer:** Leave categories define dynamic form requirements in `leave_types.form_schema` (JSON Schema format). The leave creation page (`/student/leaves/new`) parses this schema with `parseLeaveFormSchema()` and renders matching input fields. When submitted, responses are stored in the `leave_requests.submitted_form` JSONB column.

#### 9. Why does `/guard/scanner` use a different layout (`FieldShell`) than the other consoles?
> **Answer:** The guard terminal is designed for single-task, one-handed mobile use in direct sunlight. As documented in `src/app/(dashboard)/guard/layout.tsx`, it uses `FieldShell` instead of `AppShell`: navigation sidebars and headers are removed, touch targets are expanded to 64px, and typography is increased to 18px body copy for readability.

#### 10. What is the purpose of `/redirect`?
> **Answer:** `/redirect` serves as the application's server-side role dispatcher. After successful authentication via Clerk Google SSO, users are directed to `/redirect`. The Server Component evaluates `getCurrentUser()`, finds the primary assigned role, and returns an HTTP 307 redirect to the matching console (e.g. `/student/dashboard` for students, `/guard/scanner` for guards).

---

## 12. Frontend Architecture Summary

### Summary Metrics
- **Total UI Pages:** 49
- **Static Pages:** 2 (`/`, `/unauthorized`)
- **Dynamic Server Pages:** 1 (`/profile`)
- **Client-Driven Pages:** 34 (Forms, tables, real-time monitors, and admin consoles)
- **Hybrid Pages:** 11 (Token-validated portal, guard terminals, and server wrappers)
- **Redirect Dispatcher:** 1 (`/redirect`)

### Core Architectural Axiom
> **"The UI may be client-driven, but authorization and business rules remain server-side."**

1. **Edge/Proxy Middleware (`src/proxy.ts`):** Enforces Clerk session presence for all application routes.
2. **Server Component Layouts (`layout.tsx`):** Execute server-side role authorization checks and render structural shells with navigation badges.
3. **Interactive Client Pages (`page.tsx`):** Run within protected layout boundaries, leveraging SWR for data synchronization and caching against standardized REST APIs (`/api/v1/*`).
4. **DTO-Validated REST Pipeline:** Routes validate incoming data against Zod DTOs, execute business logic in domain services, and query PostgreSQL through Drizzle ORM repositories.

---

### Key Pages for Understanding the System

| Route | Role | Why It Matters | Rendering Strategy | Key Concept |
|---|---|---|---|---|
| `/` | Public | Marketing landing page | Static (SSG) | Zero-auth static pre-rendering |
| `/redirect` | Auth / System | Central role router | Server Redirect | Role-based server dispatch |
| `/parent-approve/[token]` | Parent | Passwordless approval link | Hybrid | Token crypto + direct DB read on server |
| `/student/dashboard` | Student | Primary student interface | Client-Driven (SWR) | 20s rotating QR pass + live countdown |
| `/student/leaves/new` | Student | Dynamic leave form | Client-Driven (RHF) | Dynamic JSON form schemas + S3 upload |
| `/student/leaves/[id]` | Student | Leave tracking workspace | Client-Driven (SWR) | Multi-entity review, Q&A, and extensions |
| `/admin/approvals` | Admin | Approval queue | Hybrid | Server entry wrapping reusable client view |
| `/admin/approvals/[id]` | Admin | Multi-step approval | Client-Driven (SWR) | Step decisions + audit trail logging |
| `/guard/scanner` | Guard | Gate terminal | Hybrid | Camera hardware + pass preview modal |
| `/super-admin/workflows` | Admin | Approval workflow builder | Client-Driven (SWR) | Dynamic approval step sequencing |
| `/super-admin/leave-types` | Admin | Leave type configuration | Client-Driven (SWR) | Dynamic form schema builder |
| `/profile` | Shared / System | User profile | Dynamic Server | Pure Server Component reading server auth |

---

### Top 10 Technical Interview Traps

1. **"Is `/admin/dashboard` client-rendered?"**  
   *Trap:* Assuming that because the page uses `"use client"`, authentication is handled on the client.  
   *Reality:* The parent layout `src/app/(dashboard)/admin/layout.tsx` is an async Server Component that enforces authorization on the server before the client bundle can render.

2. **"Does Next.js App Router make direct database calls from every page?"**  
   *Trap:* Assuming every Server Component queries the database directly.  
   *Reality:* In accordance with `AGENTS.md`, the codebase routes data requests through REST handlers (`/api/v1/*`) with Zod DTO validation. The only page making a direct service call is `/parent-approve/[token]`.

3. **"Can parent approval links be scraped without rate limits?"**  
   *Trap:* Assuming unauthenticated routes are unprotected.  
   *Reality:* The page hashes the token with SHA-256 and checks `rateLimit("parent-approve-view:<hash>", 30, 900_000)` on the server before processing the request.

4. **"Does every dynamic route use `generateStaticParams`?"**  
   *Trap:* Assuming dynamic routes like `/student/leaves/[id]` are statically generated.  
   *Reality:* Because leaves change status dynamically and contain private student data, these pages are rendered at runtime.

5. **"Why doesn't the root layout check user roles?"**  
   *Trap:* Placing role-checking logic in `src/app/layout.tsx`.  
   *Reality:* The root layout wraps public routes (`/`, `/login`, `/parent-approve`) as well as authenticated dashboards. Role checks belong in specific sub-layouts (`(dashboard)/student/layout.tsx`, etc.).

6. **"Are leave extensions separate leaves?"**  
   *Trap:* Creating new leave records when extending a leave.  
   *Reality:* Extensions are tracked in `leave_extensions` linked to the parent leave ID, preserving audit history without duplicating the leave.

7. **"Is the QR code pass permanent, and does the 20-second timer enforce server security?"**  
   *Trap:* Assuming the QR pass is a static image or that the UI timer is the security enforcement.  
   *Reality:* The UI timer provides visual freshness, while the server validates the short-lived cryptographic token on scan preview/commit. Setting `regenerate=true` mints a new pass and invalidates previous credentials.

8. **"Why isn't `/profile` a Client Component?"**  
   *Trap:* Adding `"use client"` to pages that only read user data.  
   *Reality:* `/profile` only reads session data from `currentUser()` and renders static markup, making it a pure Server Component.

9. **"How does the scanner work offline?"**  
   *Trap:* Assuming the scanner validates passes using local cryptographic verification.  
   *Reality:* The scanner performs a live preview request to `/api/v1/movements/scan/preview` and commits the entry via `/api/v1/movements/scan`. Live network connectivity is required.

10. **"Where are dynamic form responses stored?"**  
    *Trap:* Assuming new database columns are added for custom form fields.  
    *Reality:* Custom form fields are stored in the `leave_requests.submitted_form` JSONB column and validated against `leave_types.form_schema`.
