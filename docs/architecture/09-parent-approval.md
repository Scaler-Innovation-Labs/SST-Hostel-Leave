# 09 — Parent Approval Subsystem

**Purpose:** Comprehensive technical guide to parent authentication, high-entropy token generation, cryptographic storage, expiry handling, and decision processing.  
**Audience:** Security engineers, backend developers, and compliance reviewers.  
**Status:** **IMPLEMENTED** (Verified from `src/services/parent/*` and `src/app/api/parent-approve/[token]/decision/route.ts`)

---

## 1. Architectural Philosophy: Why No Parent Login?

As documented in `AGENTS.md`:
* Parents do **not** have user accounts, passwords, or Clerk sessions.
* Requiring parents to register, download apps, or manage credentials leads to abandoned leave requests and excessive warden support tickets.
* Instead, parent decisions authenticate via **one-time cryptographically secure magic links** delivered over verified SMS or email.

```mermaid
flowchart LR
    LeaveCreate[Leave Submitted] --> Outbox[Outbox Event: PARENT_APPROVAL_REQUIRED]
    Outbox --> GenSvc[generateParentApproval]
    GenSvc --> TokenCrypto["Generate 32 Random Bytes<br/>Hash with SHA-256"]
    TokenCrypto --> DB[("Store SHA-256 Hash<br/>in leave_approvals")]
    TokenCrypto --> SMS["Send SMS with Raw Token<br/>Link: /parent-approve/{rawToken}"]
    
    SMS -. Parent clicks link .-> DecisionAPI["POST /api/parent-approve/{token}/decision"]
    DecisionAPI --> HashCheck["SHA-256(incoming token)<br/>Compare with DB Hash"]
    HashCheck --> StatusUpdate["Update leave_approvals to APPROVED<br/>Advance Workflow"]
```

---

## 2. Token Generation & Storage Architecture

### 2.1 Cryptographic Token Minting
Implemented in `src/services/parent/generate-parent-approval.service.ts`:
```ts
// 1. Generate 32 bytes of cryptographically secure random entropy (256 bits)
const rawBytes = new Uint8Array(32);
crypto.getRandomValues(rawBytes);
const rawToken = toHex(rawBytes); // 64 hex characters

// 2. Hash the raw token before storing in database
const tokenHash = await sha256(rawToken);

// 3. Compute expiration time
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + PARENT_APPROVAL_TOKEN_EXPIRY_HOURS); // Default: 48 hours
```

### 2.2 Security Invariant: No Plaintext Storage
* The database **never** stores `rawToken`.
* Only `tokenHash` (SHA-256) is persisted in `leave_approvals.parent_approval_token`.
* If the database is compromised, an attacker cannot forge or click parent approval links because SHA-256 is a one-way collision-resistant hash.

---

## 3. Decision Processing Sequence

```mermaid
sequenceDiagram
    participant Parent as Parent Phone / Browser
    participant API as POST /api/parent-approve/[token]/decision
    participant Svc as parentApproveDecision()
    participant DB as PostgreSQL
    participant Outbox as outboxService

    Parent->>API: POST /api/parent-approve/{rawToken}/decision { decision: "APPROVED", comments: "OK" }
    Note over API: Public endpoint (no Clerk session)
    
    API->>Svc: Execute parent decision
    Svc->>Svc: tokenHash = sha256(rawToken)

    Svc->>DB: BEGIN TRANSACTION
    Svc->>DB: SELECT leave_approvals WHERE parent_approval_token = tokenHash FOR UPDATE
    
    alt Token not found
        Svc-->>API: throw NotFoundError("Invalid or expired approval link")
    else Token expired (expires_at < now())
        Svc-->>API: throw ConflictError("This approval link has expired")
    else Already decided (decision !== 'PENDING')
        Svc-->>API: throw ConflictError("This leave request has already been acted upon")
    end

    Svc->>DB: UPDATE leave_approvals SET decision = 'APPROVED', acted_at = now()
    Svc->>DB: INSERT audit_logs (Actor: PARENT, Trigger: SMS/PORTAL)
    
    Svc->>DB: SELECT leave_requests FOR UPDATE
    Svc->>DB: Resolve workflowEngine next step
    
    alt Next Step Exists (e.g. Warden Approval)
        Svc->>DB: UPDATE leave_requests SET current_step_key = next.stepKey
        Svc->>Outbox: publish(LEAVE_APPROVAL_REQUIRED)
    else Final Step
        Svc->>DB: UPDATE leave_requests SET status = 'APPROVED'
        Svc->>Outbox: publish(LEAVE_APPROVED)
    end
    
    Svc->>DB: COMMIT TRANSACTION
    Svc-->>Parent: 200 OK { success: true }
```

---

## 4. Replay & Abuse Protections

1. **Single-Use Guarantee**: Once `decision` transitions from `PENDING` to `APPROVED` or `REJECTED`, any subsequent click with the same token is rejected with `409 ConflictError("This leave request has already been acted upon")`.
2. **Token TTL Expiration**: `parent_approval_expires_at` is checked on every query. Expired tokens cannot execute decisions.
3. **Pessimistic Locking**: Concurrent requests with the same token lock the row via `FOR UPDATE`, preventing double-execution.
4. **Audit Attribution**: Audit records record `actorType: ACTOR_TYPE.PARENT` and `trigger: AUDIT_TRIGGER.SMS` to distinguish off-platform parent actions from authenticated staff operations.

---

## 5. Administrative Overrides

Parent approval steps are normally resolved through the parent approval link. Authorized administrators may override a parent approval step when operationally necessary; such overrides must be explicitly authorized and auditable.
