# 20 — Non-Technical System Explanation

**Purpose:** Plain-language operational guide for hostel administrators, wardens, university leadership, and parent representatives.  
**Audience:** Non-technical stakeholders, residential deans, hostel wardens, and administrative staff.  
**Status:** **IMPLEMENTED**

---

## 1. What Does This System Do?

The SST Hostel Leave Platform is an automated digital system that manages student hostel leave requests and physical campus gate movement.

In simple terms:
1. **Students** apply for leave using their phones or laptops instead of writing paper slips.
2. **Parents** receive an instant SMS with a secure link to approve or reject the request with one tap—no login or password needed.
3. **Faculty Mentors & Hostel Wardens** review requests on their digital dashboard, with automatic checks preventing invalid dates or rule violations.
4. **Security Guards** scan a digital QR pass on the student’s phone when they leave and return through the campus gate.
5. **Administrators** see real-time headcounts of who is currently in the hostel, who is outside, and who is overdue.

---

## 2. A Real-World Example: Rohan Goes Home for Diwali

To understand how the system works from start to finish, consider this everyday example:

### Step 1: The Application (Thursday 10:00 AM)
* **Rohan**, a 2nd-year computer science student living in Boys Hostel 1, wants to travel home for the Diwali long weekend.
* He logs into the student portal, selects **"Home Pass"**, enters his departure time (Friday 4:00 PM) and return time (Monday 8:00 PM), and writes his reason.
* The system instantly checks university rules:
  * *Is his batch restricted?* No.
  * *Is the leave longer than 7 days?* No, it's 3 days.
  * *Are there exams scheduled during this window?* No.
* The request is created in **Pending** status.

### Step 2: Parent Verification (Thursday 10:01 AM)
* Within seconds, Rohan's father, **Mr. Sharma**, receives an official SMS on his verified mobile number:
  > *"SST Hostel: Rohan has requested a Home Pass from 24 Oct to 27 Oct. Click here to review and approve: https://hostel.sst.edu.in/parent-approve/a8f9c2..."*
* Mr. Sharma taps the link on his phone. A clean web page opens showing Rohan's departure details.
* He taps **"Approve"**.
* The approval is instantly recorded in the system with a digital timestamp.

### Step 3: Warden Approval (Thursday 2:00 PM)
* The Chief Warden logs into the administrative portal. Rohan's request appears at the top of the queue with a green badge: **"Parent Approved"**.
* The warden clicks **"Approve"**.
* The leave is now **Officially Approved**. A secure, personalized digital QR gate pass is generated and delivered to Rohan's student app.

### Step 4: Leaving the Campus (Friday 4:15 PM)
* Rohan walks to the main university gate with his bag.
* He opens the student app and presents his digital QR pass to the security guard on duty.
* The guard points his handheld scanner at Rohan's phone.
* The scanner instantly beeps green and shows:
  * **Rohan Sharma** (Roll: 21BCE1002, Room: B-304)
  * **Status**: Valid Exit Pass (Diwali Home Pass)
* The guard taps "Confirm Exit".
* Rohan walks out the gate. At this exact second, his status in the university database changes from **In Hostel** to **Outside Hostel**.

### Step 5: Returning to Campus (Monday 7:30 PM)
* Rohan returns on Monday evening, well before the 8:00 PM curfew.
* At the gate, the guard scans the exact same QR pass.
* The scanner recognizes this as a **Return Scan**, checks Rohan back in, and closes the pass.
* Rohan's status updates to **In Hostel**, and the leave request is marked **Completed**.
* An automated email is sent to Mr. Sharma confirming Rohan has returned safely to the hostel.

---

## 3. What Happens When Things Go Wrong?

### What if Rohan forgets to leave?
If Rohan gets sick on Friday and decides not to travel, he never scans his pass at the gate. At midnight, the system recognizes that the exit window closed without a gate scan. The pass automatically marks itself **Expired**, and Rohan remains listed as safe inside the hostel.

### What if Rohan returns late?
If Rohan does not return by 8:00 PM on Monday and hasn't requested an extension:
* At 8:30 PM (after the grace period), the system automatically flags Rohan as **Overdue**.
* An alert appears on the warden's emergency dashboard.
* Automated SMS/Slack alerts are dispatched to the warden and residential staff so they can call Rohan or his family immediately.

### What if a parent doesn't have a smartphone?
If a parent cannot open the web link, the warden can contact the parent via phone call, verify consent, and use the **Warden Override** button on their dashboard. The system logs that the warden manually verified parent approval, ensuring a full audit trail.
