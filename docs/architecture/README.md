# SST Hostel Leave & Movement Management Platform
## Complete Architecture & Engineering Documentation Pack

Welcome to the definitive engineering documentation for the **SST Hostel Leave System**. This documentation pack has been constructed through systematic inspection of the production codebase, verifying source code, Drizzle schemas, database migrations, domain services, API route handlers, and automated test specifications.

---

## 1. Documentation Index & Navigation

| Document | Title | Purpose & Scope | Verification Status |
| :--- | :--- | :--- | :--- |
| [**01**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/01-system-overview.md) | [System Overview](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/01-system-overview.md) | Executive summary, business mission, 5 core user roles, key domains, tech stack | **IMPLEMENTED** |
| [**02**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/02-hld-system-architecture.md) | [High-Level Architecture](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/02-hld-system-architecture.md) | End-to-end component topology, service interactions, synchronous vs async boundaries | **IMPLEMENTED** |
| [**03**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/03-application-layer-architecture.md) | [Application Layer Architecture](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/03-application-layer-architecture.md) | Mandatory 4-layer architecture, DTOs, domain error hierarchy, ESLint boundaries | **IMPLEMENTED** |
| [**04**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/04-lld-domain-design.md) | [Low-Level Domain Design](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/04-lld-domain-design.md) | Class/object design, public interfaces, domain invariants, transactions, state machines | **IMPLEMENTED** |
| [**05**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/05-database-schema-and-erd.md) | [Database Schema & ERD](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/05-database-schema-and-erd.md) | Full entity-relationship diagrams, constraints, indexes, immutable versioning tables | **IMPLEMENTED** |
| [**06**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/06-api-catalog.md) | [API Catalog & Request Lifecycle](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/06-api-catalog.md) | Comprehensive route catalog, auth requirements, input/output schemas, error shapes | **IMPLEMENTED** |
| [**07**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/07-leave-creation-end-to-end.md) | [Leave Creation End-to-End](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/07-leave-creation-end-to-end.md) | Deepest technical trace: validation, policy evaluation, atomic DB transaction, outbox | **IMPLEMENTED** |
| [**08**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/08-approval-workflow.md) | [Approval Workflow Engine](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/08-approval-workflow.md) | Step advancement, pessimistic locking, POC/Warden review, parent override mechanics | **IMPLEMENTED** |
| [**09**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/09-parent-approval.md) | [Parent Approval Subsystem](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/09-parent-approval.md) | Tokenized magic links, SHA-256 storage, expiry windows, unauthenticated decision route | **IMPLEMENTED** |
| [**10**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/10-qr-and-movement-lifecycle.md) | [QR & Movement Lifecycle](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/10-qr-and-movement-lifecycle.md) | Gate scan concurrency, physical transit events, leave approval vs movement reality | **IMPLEMENTED** |
| [**11**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/11-recurring-late-stay.md) | [Late-Stay & Occurrence Claims](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/11-recurring-late-stay.md) | Analysis of `LATE_STAY_COLLEGE` workflow vs recurring authorization patterns | **PARTIALLY IMPLEMENTED** |
| [**12**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/12-notification-and-outbox.md) | [Notification Outbox Pattern](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/12-notification-and-outbox.md) | Transactional outbox, lease-based claim loop, multi-channel dispatch, dead-letter | **IMPLEMENTED** |
| [**13**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/13-authentication-and-authorization.md) | [Auth & Scoped Access Control](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/13-authentication-and-authorization.md) | Clerk identity linking, 5 roles, hostel/department resource scoping, permission matrix | **IMPLEMENTED** |
| [**14**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/14-background-jobs-and-cron.md) | [Background Jobs & Cron](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/14-background-jobs-and-cron.md) | Daily cleanup & maintenance crons, bearer auth gate, auto-expiry, outbox purging | **IMPLEMENTED** |
| [**15**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/15-deployment-and-infrastructure.md) | [Deployment & Infrastructure](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/15-deployment-and-infrastructure.md) | Vercel Edge/Serverless runtime, Neon PostgreSQL, AWS S3/SES, Resend, Twilio, Slack | **IMPLEMENTED** |
| [**16**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/16-security-and-threat-model.md) | [Security & Threat Model](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/16-security-and-threat-model.md) | STRIDE analysis, QR token crypto (AES-256-GCM), token hashing, OWASP mitigations | **IMPLEMENTED** |
| [**17**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/17-failure-modes-and-recovery.md) | [Failure Modes & Recovery Matrix](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/17-failure-modes-and-recovery.md) | Exhaustive failure scenarios, concurrency races, network partitions, recovery protocols | **IMPLEMENTED** |
| [**18**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/18-testing-and-quality.md) | [Testing & Quality Assurance](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/18-testing-and-quality.md) | Vitest test suite breakdown, state machine tests, architectural lint rules, test gaps | **IMPLEMENTED** |
| [**19**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/19-technical-design-decisions.md) | [Architecture Decision Records (ADR)](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/19-technical-design-decisions.md) | In-depth engineering rationale behind 10 foundational design choices | **IMPLEMENTED** |
| [**20**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/20-nontechnical-system-explanation.md) | [Non-Technical System Guide](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/20-nontechnical-system-explanation.md) | Plain-language operational guide for hostel wardens, administrative staff, and parents | **IMPLEMENTED** |
| [**21**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/21-developer-onboarding-and-code-navigation.md) | [Developer Onboarding Guide](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/21-developer-onboarding-and-code-navigation.md) | New engineer walkthrough, local setup, code navigation rules, how to add a leave type | **IMPLEMENTED** |
| [**22**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/22-interview-defense-guide.md) | [Interview Defense Guide](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/22-interview-defense-guide.md) | High-stakes technical interview defense scripts, concurrency questions, scale limits | **IMPLEMENTED** |
| [**23**](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/23-gaps-and-unverified-behavior.md) | [Engineering Gaps & Roadblocks](file:///c:/Users/Veda/Desktop/SST-Hostel-Leave/docs/architecture/23-gaps-and-unverified-behavior.md) | Unvarnished gap analysis: millisecond ID collisions, audit snapshots, rate limiting | **IMPLEMENTED** |

---

## 2. Verification Status Legend

All claims across this documentation suite strictly adhere to repository reality:

* **`IMPLEMENTED`**: Explicitly verified by existing source code, schema files, repository queries, and passing unit/integration tests.
* **`PARTIALLY IMPLEMENTED`**: Core building blocks or database structures exist, but certain high-level guarantees, background workers, or operational workflows are incomplete or managed through alternate routes.
* **`INFERRED`**: Logical architectural deductions based on configuration, comments, and framework defaults, but lacking explicit programmatic enforcement.
* **`NOT VERIFIED`**: Features or behaviors where repository evidence was insufficient or inaccessible without live infrastructure.
* **`NOT IMPLEMENTED`**: Confirmed absence in the repository despite conceptual presence in initial domain specifications.

---

## 3. Recommended Reading Order

1. **New Developers & Onboarding:**
   `01-system-overview` → `03-application-layer-architecture` → `21-developer-onboarding-and-code-navigation` → `07-leave-creation-end-to-end`
2. **Backend & Database Engineers:**
   `02-hld-system-architecture` → `04-lld-domain-design` → `05-database-schema-and-erd` → `08-approval-workflow` → `12-notification-and-outbox`
3. **Security, Quality & Site Reliability Reviewers:**
   `13-authentication-and-authorization` → `16-security-and-threat-model` → `17-failure-modes-and-recovery` → `14-background-jobs-and-cron` → `23-gaps-and-unverified-behavior`
4. **Interview & System Defense Preparation:**
   `19-technical-design-decisions` → `22-interview-defense-guide`
5. **Hostel Administrators & Non-Technical Stakeholders:**
   `20-nontechnical-system-explanation`
