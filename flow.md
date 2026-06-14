dude see let's complete one leave from start to end long leave submit leave requests in-app notification then policy check then workflow generation if parent then sms if poc then slack in app notification on approval for student for both on rejected mail to student cc parent if parent approves sms to parent then slack notification to admin in the http://localhost:3000/super-admin/approvals page he see the leave with enough details so that he can click on approve reject button if required he will open the ticket and then comment and approve/reject then mail to student+parent

Exactly. Stop thinking about leave types → notifications.

Think about business events → notification orchestration.

For a single leave request, let's walk through the full lifecycle.

Student Submits Leave

Student fills:

Destination: Hyderabad
Reason: Family Function
From: 20 Jun
To: 25 Jun

Student clicks:

Submit Leave
Step 1 — Create Leave

Inside transaction:

Create Leave Request
Evaluate Policies
Resolve Workflow
Create Approval Records
Create Audit Log
Create Outbox Events
Commit

No SMS.

No email.

No Slack.

Only:

outbox_events

are written.

Example:

LEAVE_SUBMITTED
APPROVAL_REQUIRED
Step 2 — Outbox Worker Runs

Worker reads:

LEAVE_SUBMITTED
Notification Rules Engine

Rule:

Event:
LEAVE_SUBMITTED

Recipients:
Student

Channels:
In-App

Creates:

notification_logs

and delivers:

In-App Notification

Student sees:

Your leave request has been submitted.
Request #LR-1024
Policy Requires Parent Approval

Workflow:

Parent
↓
POC
↓
Warden

Current step:

Parent

Worker processes:

PARENT_APPROVAL_REQUIRED

Rule:

Recipient:
Parent

Channel:
SMS

SNS sends:

Your child submitted a leave request.

Approve:
https://app.com/parent-approve/abc123
Parent Approves

Parent:

OTP Login
Approve

System:

Update approval row
Advance workflow
Audit log
Outbox event

Event:

PARENT_APPROVED
Worker Processes PARENT_APPROVED

Rule:

Recipient:
POC

Channel:
Slack
In-App

Slack:

New leave awaiting approval.

Student:
John Doe

Leave:
LR-1024

In-App:

1 Pending Approval
POC Dashboard

POC sees:

Approvals

Card:

Student:
John Doe

Department:
CSE

Leave:
20 Jun → 25 Jun

Reason:
Family Function

Parent:
Approved

Current Step:
POC

Buttons:

Approve
Reject
POC Rejects

POC enters:

Reason:
Attendance shortage

Clicks:

Reject

Transaction:

Approval Updated
Leave Status Updated
Audit Created
Outbox Event Created

Event:

LEAVE_REJECTED
Worker Processes LEAVE_REJECTED

Rule:

Recipients:
Student
Parent

Channels:
Email
SMS
In-App

Email:

To:
student@email.com

CC:
parent@email.com

Subject:

Leave Request Rejected

Body:

Request #LR-1024

Rejected By:
POC

Reason:
Attendance shortage
POC Approves Instead

Event:

APPROVAL_COMPLETED

Workflow advances:

Warden

Worker:

Notify Warden

Slack:

Leave awaiting approval

In-App:

1 Pending Approval
Warden Opens Approval

Page:

/super-admin/approvals/[id]

or

/admin/approvals/[id]

Should show:

Student Information
--------------------------------

Name
Department
Year
Hostel
Room

Parent Information
--------------------------------

Name
Phone
Email

Leave Information
--------------------------------

Leave Type
Destination
Reason
Dates
Duration

Policy Evaluation
--------------------------------

✓ Parent Approved
✓ Within Max Days
✓ Not During Exam

Workflow Timeline
--------------------------------

Parent ✓
POC ✓
Warden (Current)

Comments
--------------------------------

Parent Comment
POC Comment

Attachments
--------------------------------

Medical Certificate
ID Proof

Audit Timeline
--------------------------------

Created
Parent Approved
POC Approved

Actions:

Approve
Reject
Request Clarification
Warden Approves

Transaction:

Final Approval
Leave Approved
Audit
Outbox Event

Event:

LEAVE_APPROVED
Worker Processes LEAVE_APPROVED

Rule:

Recipients:
Student
Parent

Channels:
Email
SMS
In-App

Email:

To:
Student

CC:
Parent

SMS:

Your leave has been approved.

In-App:

Leave Approved
Generate QR

Another event:

QR_GENERATED

Rules:

Student

Channels:

In-App
Email

Message:

QR pass generated.
Architecture

You do NOT configure:

Home Pass
→ Student SMS
→ Parent Email

Instead configure:

Event
↓
Recipient
↓
Channel
↓
Template

Example:

LEAVE_SUBMITTED
PARENT_APPROVAL_REQUIRED
PARENT_APPROVED
APPROVAL_PENDING
LEAVE_APPROVED
LEAVE_REJECTED
QR_GENERATED
LEAVE_COMPLETED
EXTENSION_REQUESTED
EXTENSION_APPROVED