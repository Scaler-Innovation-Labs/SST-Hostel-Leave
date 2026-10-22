# 16 — Security Architecture & Threat Model

**Purpose:** Comprehensive security analysis, STRIDE threat model, cryptographic specifications, and vulnerability mitigation inventory.  
**Audience:** Security reviewers, penetration testers, and backend engineers.  
**Status:** **IMPLEMENTED** (Verified from cryptographic utilities and route implementations)

---

## 1. Cryptographic Design & Bearer Token Protections

### 1.1 Parent Approval Magic Links
* **Risk**: If approval links are predictable or leak in database dumps, unauthorized individuals could approve student departures.
* **Mitigation**:
  1. **Entropy**: Generated using `crypto.getRandomValues(new Uint8Array(32))` $\rightarrow$ 256 bits of CSPRNG entropy.
  2. **Hash-at-Rest**: The database persists only `token_hash = sha256(rawToken)`. Plaintext tokens exist only in transit (SMS link).
  3. **Strict TTL**: Hard expiration via `parent_approval_expires_at` (default 48 hours).
  4. **Single-Use Guard**: Database transaction asserts `decision === 'PENDING'` under a `FOR UPDATE` lock.

### 1.2 QR Pass Tokens (Gate Transit Tokens)
* **Risk**: If students share QR screenshots or forged tokens, unauthorized exits could occur.
* **Mitigation**:
  1. **Token Envelope**: Generated as 32 random bytes. Encrypted at rest via **AES-256-GCM** with unique initialization vectors (`v1:<keyId>:<iv>:<ciphertext>`).
  2. **Gate Authentication**: Gate scans authenticate solely against `token_hash = sha256(rawToken)`. Even database read-replicas or logs with query parameters never expose plaintext tokens.
  3. **Window Gating**: Valid only between `valid_from` (leave start) and `expires_at` (end + grace). Outside this window, gate scans reject the pass with a visible alert on the guard terminal.

---

## 2. STRIDE Threat Model

| STRIDE Threat Category | Target Asset | Attack Scenario | Repository Defense | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Staff Identity | Attacker creates an account with a warden's email in Clerk to access the warden dashboard. | `get-current-user.ts` checks `emailVerification.status === 'verified'` before linking to a pre-provisioned DB record. | **IMPLEMENTED** |
| **Tampering** | Leave Policy Config | A student alters maximum leave days in the form payload during submission. | Policies are evaluated server-side in `policyEngine`; form schemas are validated against immutable JSON schemas. | **IMPLEMENTED** |
| **Repudiation** | Approval Actions | A warden denies approving a student's high-risk leave after an incident. | All approvals write immutable rows to `audit_logs` capturing `actorUserId`, `action`, `acted_at`, and decision metadata. | **IMPLEMENTED** |
| **Information Disclosure** | Parent URLs in Outbox | Long-term stored outbox payloads expose valid parent approval links. | `runPurgeOutboxJob` sweeps and deletes processed outbox rows past the retention horizon. | **IMPLEMENTED** |
| **Denial of Service** | Gate Terminal Scans | Flooding the scan API with fake QR tokens to delay physical student checkouts. | `rate_limit` repository enforces per-IP / per-terminal rate limits; scans fail fast on SHA-256 hash lookup. | **IMPLEMENTED** |
| **Elevation of Privilege** | Cross-Hostel Tampering | Warden of Hostel A attempts to approve leaves for students in Hostel B. | `assertCanAccessLeave` verifies student's `hostelId` matches the caller's `user_roles.scope_id`. | **IMPLEMENTED** |

---

## 3. Concurrency Threats & Race Condition Mitigations

### 3.1 Simultaneous Gate Scan Race (Double Exit)
* **Threat**: A student displays their QR pass on two phones simultaneously to two guards at adjacent gate lanes.
* **Mitigation**: `qrPassRepository.markAsFirstScanned(pass.id, tx)` runs inside a database transaction:
  ```sql
  UPDATE qr_passes
  SET first_scan_at = now()
  WHERE id = $1 AND first_scan_at IS NULL AND status = 'ACTIVE'
  RETURNING id;
  ```
  The second concurrent update receives zero rows affected and throws `409 ConflictError("QR pass was concurrently scanned or invalidated")`. Exactly one physical exit is logged.

### 3.2 Concurrent Leave Submissions (Duplicate Overlap)
* **Threat**: Student rapidly double-clicks "Submit" on a leave request.
* **Mitigation**:
  1. Transaction executes `studentRepository.findByIdForUpdate(student.id, tx)`, locking the student row.
  2. `assertNoConflictingOverlap` checks for overlapping active leaves.
  3. The second request is blocked at the row lock; when it executes, it detects the overlap created by the first request and rolls back.

---

## 4. Residual Risks & Security Recommendations

1. **Millisecond Request Number Collision**:
   * *Residual Risk*: `request_number` uses `LR-${Date.now()}`. Two submissions within the exact same millisecond will collide on the database unique constraint.
   * *Recommendation*: Append a random 4-character crypto suffix (e.g. `LR-${Date.now()}-${randomHex(2)}`) or use a PostgreSQL sequence.
2. **Audit Snapshot Gaps**:
   * *Residual Risk*: `audit_logs.old_data` and `audit_logs.new_data` are not populated in `auditService.record()`. State diffs must currently be inferred from domain tables.
   * *Recommendation*: Implement entity snapshot serialization for audit compliance.
