# 06 — API Catalog & Request Lifecycle

**Purpose:** Comprehensive catalog of all HTTP REST routes, request/response DTO schemas, authentication gates, and database side effects.  
**Audience:** Frontend engineers, API consumers, integration partners, and security auditors.  
**Status:** **IMPLEMENTED** (Verified directly from `src/app/api/**/route.ts`)

---

## 1. Authentication & Security Headers

All API endpoints fall under three security categories:
1. **Authenticated Internal Routes (`requireAuth()`)**: Verified via Clerk session cookie / Bearer JWT. Identifies user, roles, and hostel scopes.
2. **Public Parent Approval Route**: No session cookie. Authenticates solely via high-entropy token in URL path (`/api/parent-approve/[token]/decision`).
3. **Internal Cron & Maintenance Routes (`checkCronAuth()`)**: Requires `Authorization: Bearer <CRON_SECRET>` where `CRON_SECRET` length must be $\ge 32$ characters.

---

## 2. Leave Management Endpoints

### 2.1 Submit Leave Request
* **HTTP Route**: `POST /api/v1/leaves`
* **Auth & Role**: Required (`STUDENT` only)
* **Request DTO** (`CreateLeaveDto`):
  ```json
  {
    "leaveTypeId": "4a7f23be-9351-4191-8178-9e5b7dcbe76a",
    "startAt": "2026-10-20T09:00:00.000Z",
    "endAt": "2026-10-22T18:00:00.000Z",
    "reason": "Attending sibling's wedding",
    "submittedForm": {
      "destinationCity": "Chennai",
      "emergencyContact": "+919876543210"
    },
    "pocId": "optional-mentor-user-uuid"
  }
  ```
* **Success Response (201)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "e8d64c12-32b4-4b51-93e1-382a5c9a4192",
      "requestNumber": "LR-1738914000123",
      "status": "PENDING",
      "currentStepKey": "PARENT_APPROVAL"
    }
  }
  ```
* **Error Codes**: `401 UNAUTHENTICATED`, `403 UNAUTHORIZED` (Non-student), `404 NOT_FOUND` (LeaveType), `409 CONFLICT` (Policy violation or date overlap), `422 VALIDATION_ERROR`.
* **Side Effects**: Atomic DB transaction inserts leave, workflow version snapshot, policy evaluation records, approval steps, audit log, and `LEAVE_CREATED` outbox event.

### 2.2 List Leaves
* **HTTP Route**: `GET /api/v1/leaves`
* **Auth & Role**: Required (`STUDENT` sees own; `ADMIN`/`POC`/`SUPER_ADMIN` scoped to hostel).
* **Query Parameters**: `status`, `leaveTypeId`, `studentId`, `page`, `pageSize`, `search`.

### 2.3 Approve / Advance Leave Step
* **HTTP Route**: `POST /api/v1/leaves/[id]/approve`
* **Auth & Role**: Required (`POC`, `ADMIN`, `SUPER_ADMIN`)
* **Request DTO** (`ApproveLeaveDto`):
  ```json
  {
    "decision": "APPROVED",
    "comments": "Verified tickets and parent consent",
    "documentsVerified": true,
    "confirmParentOverride": false
  }
  ```
* **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "leaveId": "e8d64c12-32b4-4b51-93e1-382a5c9a4192",
      "decision": "APPROVED",
      "newStatus": "APPROVED",
      "stepKey": null
    }
  }
  ```
* **Side Effects**: Row-locked update on `leave_requests` and `leave_approvals`. If final step: issues QR pass (AES-256-GCM encrypted envelope + SHA-256 hash), emits `QR_GENERATED` and `LEAVE_APPROVED` outbox events.

### 2.4 Cancel Leave Request
* **HTTP Route**: `POST /api/v1/leaves/[id]/cancel`
* **Auth & Role**: Required (`STUDENT` owner only; must be in `PENDING` or future `APPROVED` state).

---

## 3. Parent Approval Route

### 3.1 Parent Decision via Magic Link
* **HTTP Route**: `POST /api/parent-approve/[token]/decision`
* **Auth & Role**: Public (Token authenticated; no Clerk session).
* **Request Body**:
  ```json
  {
    "decision": "APPROVED",
    "comments": "Approved via SMS portal"
  }
  ```
* **Execution Path**:
  1. Hashes incoming URL `token` using SHA-256.
  2. Queries `leave_approvals` by `parent_approval_token`.
  3. Validates `parent_approval_expires_at > now()` and `decision === 'PENDING'`.
  4. Records parent approval, advances workflow, and publishes `LEAVE_APPROVED` or `LEAVE_APPROVAL_REQUIRED` to outbox.

---

## 4. Movement & QR Gate Scanning Endpoints

### 4.1 Preview QR Scan (Read-Only Guard Gate Check)
* **HTTP Route**: `GET /api/v1/movements/scan/preview?token=<raw_token>`
* **Auth & Role**: Required (`GUARD`, `ADMIN`, `SUPER_ADMIN`)
* **Purpose**: Identity check before opening physical gate. Does NOT mutate state or log movements.
* **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "valid": true,
      "scanType": "EXIT_SCAN",
      "student": {
        "name": "Rohan Sharma",
        "rollNumber": "21BCE1002",
        "roomNumber": "B-304",
        "hostelName": "Boys Hostel 1"
      },
      "leave": {
        "typeName": "Home Pass",
        "startAt": "2026-10-20T09:00:00.000Z",
        "endAt": "2026-10-22T18:00:00.000Z",
        "status": "APPROVED"
      }
    }
  }
  ```

### 4.2 Commit QR Gate Scan
* **HTTP Route**: `POST /api/v1/movements/scan`
* **Auth & Role**: Required (`GUARD`, `ADMIN`, `SUPER_ADMIN`)
* **Request Body**:
  ```json
  {
    "token": "raw-32-byte-hex-token",
    "scannedBy": "guard-user-uuid",
    "scanType": "EXIT_SCAN"
  }
  ```
* **Side Effects**:
  * Atomically validates pass window (`validFrom <= now <= expiresAt`).
  * Checks for conflicting active exit sessions.
  * Atomically sets `first_scan_at` (for Exit) or `closed_at` (for Return).
  * Creates `qr_scan_logs` record and `movement_events` transition.
  * Updates `students.current_location_state`.
  * If return scan: sets `leave_requests.status = 'COMPLETED'`.

---

## 5. Maintenance & Cron Endpoints

### 5.1 System Cleanup Cron
* **HTTP Route**: `GET /api/cron/cleanup`
* **Schedule**: Daily at 04:00 UTC (`vercel.json`)
* **Auth**: `Authorization: Bearer <CRON_SECRET>`
* **Jobs Executed**:
  1. `cleanup-qr`: Invalidates expired QR passes.
  2. `document-retention`: Deletes old temporary documents.
  3. `audit-retention`: Purges audit logs where `expires_at < now()`.
  4. `purge-outbox`: Removes processed outbox records past the retention horizon.

### 5.2 System Maintenance Cron
* **HTTP Route**: `GET /api/cron/maintenance`
* **Schedule**: Daily at 03:00 UTC (`vercel.json`)
* **Auth**: `Authorization: Bearer <CRON_SECRET>`
* **Jobs Executed**:
  1. `retry-outbox`: Requeues failed outbox events with attempt budget remaining.
  2. `expire-leaves`: Executes in strict sequence:
     * `autoCompleteNonQrLeaves` (T16): Auto-completes non-QR leaves at end date.
     * `expireOverdueLeaves` (T6): Marks unscanned approved QR leaves as `EXPIRED`.
     * `markOverdueLeaves` (T7): Transitions students who did not return on time to `OVERDUE`.

### 5.3 On-Demand Outbox Drain
* **HTTP Route**: `POST /api/v1/outbox/process`
* **Auth**: Administrative / Worker access
* **Action**: Invokes `processPendingEvents()` to claim and deliver up to 50 pending notifications.
