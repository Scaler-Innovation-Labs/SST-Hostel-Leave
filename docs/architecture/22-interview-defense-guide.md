# 22 — Technical Interview Defense Guide

**Purpose:** Comprehensive technical defense scripts, design walkthroughs, concurrency answers, and scale boundary defenses for technical interviews.  
**Audience:** Software engineering candidates defending this project in system design and backend architecture interviews.  
**Status:** **IMPLEMENTED** (Grounded strictly in codebase evidence)

---

## 1. Fast Technical Pitches

### The 30-Second Elevator Pitch
> *"I helped build a production-grade Hostel Leave and Movement Management platform for a university campus. The system solves the disconnect between administrative leave permissions and physical gate movement. It features a strict 4-layer architecture in Next.js, configuration-driven approval workflows, tokenized passwordless parent approvals, AES-256-GCM encrypted QR gate passes, and a transactional outbox pattern in PostgreSQL that guarantees at-least-once notifications with zero dual-write vulnerabilities."*

### The 2-Minute Architecture Walkthrough
> *"The application is structured into eight bounded domains backed by PostgreSQL on Neon. We enforce a unidirectional flow from Route Handlers through Zod DTO validation, Domain Services, and thin Repositories down to the database using automated ESLint boundary rules.*
>
> *When a student submits a leave, we first run an in-memory policy engine for curfews and blackout dates. We then open a PostgreSQL transaction, acquire a pessimistic row lock on the student record to prevent concurrent overlapping submissions, resolve the dynamic workflow steps, and freeze the exact configuration snapshot using immutable versioning tables. Within the same transaction, we insert a pending event into an outbox table.*
>
> *Once committed, an asynchronous outbox worker claims events using `SELECT ... FOR UPDATE SKIP LOCKED` with 5-minute leases, dispatching SMS magic links to parents and emails with QR passes to students. At the campus gate, guards scan QR codes against indexed SHA-256 hashes, updating real-time movement state machines in sub-50 milliseconds without decrypting raw tokens."*

---

## 2. Challenging Technical Questions & Evidence-Based Answers

### Q1: Why separate Leave Approval from Movement Reality?
**Answer:**
> *"In real campus operations, permission does not equal reality. If approving a leave automatically marked a student as 'Outside Hostel', the university's emergency headcount would be corrupted whenever a student had an approved leave but stayed in their room due to illness or canceled plans.
>
> In our database, `leave_requests.status` represents permission, while `students.current_location_state` (a foreign key to `movement_states.code`) tracks physical reality. The movement state changes only when a security guard scans a QR pass at the physical perimeter gate. This allows scheduled background jobs to automatically expire approved passes that were never used, or flag students who exited but failed to return before curfew."*

### Q2: What happens if two students submit overlapping leaves at the exact same millisecond? Or if a student double-clicks "Submit"?
**Answer:**
> *"We prevent concurrent duplicate submissions through pessimistic locking and date range guards.
>
> Inside `createLeave()`, the first line of the database transaction executes `studentRepository.findByIdForUpdate(student.id, tx)`. This acquires an exclusive row lock on the student record in PostgreSQL. The second concurrent request is blocked until the first transaction commits.
>
> Once the first transaction inserts the leave and commits, the second request awakens, executes `assertNoConflictingOverlap()`, detects the newly committed active leave for those dates, and immediately aborts with a `409 ConflictError`. The database is never corrupted with overlapping leaves."*

### Q3: Why did you implement a Transactional Outbox instead of calling AWS SES or Twilio directly inside the service?
**Answer:**
> *"Directly calling external APIs inside business services creates the classic distributed systems 'dual-write' problem. If the external email provider times out or returns an error, the database transaction might roll back, or worse, the database might commit while the user receives an error screen and retries, creating duplicate leaves and phantom emails. Furthermore, external HTTP latency directly degrades user response times.
>
> By writing the notification intent to an `outbox_events` table inside the same local ACID transaction as the leave creation, we guarantee atomic persistence. If the business write fails, no notification is ever created. An asynchronous worker then polls the outbox, claims events with a lease, and handles retries with exponential backoff. This decouples our core system availability from third-party vendor downtime."*

### Q4: How do you prevent double-processing in the Outbox Worker if multiple serverless instances run concurrently?
**Answer:**
> *"In `src/db/repositories/outbox/outbox.repository.ts`, the `claimNext()` query uses `FOR UPDATE SKIP LOCKED` combined with a lease expiration column:
>
> ```sql
> UPDATE outbox_events
> SET status = 'PROCESSING',
>     lease_expires_at = now() + interval '5 minutes',
>     attempt_count = attempt_count + 1
> WHERE id IN (
>     SELECT id FROM outbox_events
>     WHERE status = 'PENDING'
>       AND (next_attempt_at IS NULL OR next_attempt_at <= now())
>     LIMIT 50
>     FOR UPDATE SKIP LOCKED
> ) RETURNING *;
> ```
>
> `SKIP LOCKED` instructs PostgreSQL to bypass any rows currently locked by another worker instance without waiting. The lease timestamp ensures that if a serverless worker abruptly crashes mid-execution, the event is automatically unlocked and reclaimed after 5 minutes."*

### Q5: How do parents authenticate without accounts, and how is it secure?
**Answer:**
> *"Parents authenticate via high-entropy one-time cryptographic URLs. When a leave requires parent approval, `generateParentApproval()` generates 32 cryptographically secure random bytes (256 bits of entropy) using `crypto.getRandomValues()`.
>
> We compute the SHA-256 hash of this raw token and store only the hash in `leave_approvals.parent_approval_token`. The raw token is sent to the verified parent phone number in an SMS link. When the parent clicks the link, the incoming token is hashed and matched against the database.
>
> This design guarantees:
> 1. Even if the database is leaked, an attacker cannot forge approval links because SHA-256 is non-reversible.
> 2. The link has an enforced TTL via `parent_approval_expires_at`.
> 3. Once decided, the status transitions away from `PENDING`, making the link single-use and immune to replay attacks."*

### Q6: How do QR gate passes work, and why do gate scans stay under 50ms?
**Answer:**
> *"When a leave is approved, we generate a 32-byte secure token. We store two representations:
> 1. An AES-256-GCM encrypted envelope (`token_enc`), used exclusively when the student opens their app to render the PNG barcode.
> 2. A SHA-256 hash (`token_hash`), indexed with a B-tree in PostgreSQL.
>
> When the security guard scans the barcode at the gate, the raw token is read by the camera, hashed locally, and queried against `token_hash`. Because the gate lookup is a simple indexed hash equality check, it requires zero decryption overhead and executes in under 5 milliseconds in the database.
>
> Concurrency at the gate is protected by an atomic update:
> `UPDATE qr_passes SET first_scan_at = now() WHERE id = $1 AND first_scan_at IS NULL AND status = 'ACTIVE'`
> If a student attempts to clone the QR code and exit across two lanes simultaneously, only one update succeeds; the second receives 0 rows affected and fails."*

### Q7: What breaks when traffic scales by 10x or 100x?
**Answer:**
> *"At 10x traffic (~10,000 movements/day):
> * Next.js on Vercel and PostgreSQL on Neon will scale effortlessly due to connection pooling via `@neondatabase/serverless`.
> * The primary bottleneck will be the outbox polling loop if executed as an on-demand cron endpoint.
>
> At 100x traffic (~100,000 movements/day):
> 1. **Outbox Worker**: Polling PostgreSQL via cron will generate high database CPU overhead. We should replace database polling with a dedicated message stream like AWS SQS or Kafka with a continuous consumer container.
> 2. **Request Number Collisions**: The current `LR-${Date.now()}` timestamp generator will experience collisions when multiple students submit in the same millisecond. We would replace this with a PostgreSQL sequence or a nanosecond snowflake ID generator.
> 3. **Gate Scans**: We should move QR token validation to a distributed Redis cache at the edge so gate lanes can validate passes locally even during cloud database network partitions."*
