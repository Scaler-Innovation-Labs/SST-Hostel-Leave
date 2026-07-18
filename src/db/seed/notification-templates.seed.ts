import { NOTIFICATION_CHANNEL } from "@/constants/notification/notification-channel";
import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event";
import { notificationTemplates } from "@/db";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

type TemplateSeed = {
  code: string;
  eventKey: string;
  channel: string;
  subject: string | null;
  templateBody: string;
};

const QR_SECTION =
  `<br>\n` +
  `<img src="{{qrCodeUrl}}" alt="QR Code for Leave" style="display:block;margin:16px auto;max-width:200px;height:auto;" />\n` +
  `<br>\n` +
  `<strong>QR Code for Leave:</strong> <a href="{{qrDashboardUrl}}">View your QR Code on Dashboard</a>\n` +
  `<br>\n<a href="{{leaveUrl}}">View Leave Details</a>\n` +
  `<br>\n<small>Scan or open the QR Code from your Dashboard when entering/exiting the hostel.</small>\n\n`;

const LEAVE_TYPE_TEMPLATES: Record<string, TemplateSeed[]> = {
  RE_EXAM: [
    {
      code: "leave_approved_email_re_exam",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Re-Exam Leave Request Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Re-Exam Leave request submitted for the period from {{startDate}} to {{endDate}}, for the reason \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "You are requested to adhere to the approved leave schedule and comply with all hostel rules and regulations during your leave period.\n\n" +
        "We wish you all the best for your examination.\n\n" +
        QR_SECTION +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_re_exam_policy",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Re-Exam Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Re-Exam Leave request for the period from {{startDate}} to {{endDate}} has been rejected as it does not comply with the hostel leave policy for re-examination leaves.\n\n" +
        "If you believe this decision was made in error or require further clarification, kindly contact the Hostel Administration.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_re_exam_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Re-Exam Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Re-Exam Leave request submitted for the period from {{startDate}} to {{endDate}}, for the reason \"{{reason}}\", has been rejected by your parent/guardian.\n\n" +
        "If you require any clarification regarding the decision, kindly coordinate with your parent/guardian directly.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_re_exam_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Re-Exam Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Re-Exam Leave request for the period from {{startDate}} to {{endDate}}, submitted for the reason \"{{reason}}\", has been reviewed by the Hostel Administration.\n\n" +
        "We regret to inform you that your request has not been approved by the Hostel Warden.\n\n" +
        "If you require any clarification regarding this decision, kindly reach out to your respective Hostel Warden.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_re_exam",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent/Guardian,\n\n" +
        "Your ward, {{studentName}} ({{rollNumber}}), has applied for a Re-Exam Leave from {{startDate}} to {{endDate}} for the following reason:\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly click the link below to review and submit your response online:\n" +
        "{{approvalLink}}\n\n" +
        "Alternatively, you may reply with:\n" +
        "1 {{leaveId}} to approve\n" +
        "2 {{leaveId}} to reject\n\n" +
        "Your response will be automatically recorded.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_submitted_slack_re_exam",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear Hostel Warden,\n\n" +
        "A new Re-Exam Leave request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly review the request and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  LONG_LEAVE: [
    {
      code: "leave_approved_email_long_leave",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Long Leave Request Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Long Leave request submitted for the period from {{startDate}} to {{endDate}}, for the reason \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "You are requested to adhere to the approved leave schedule and ensure compliance with all hostel rules and regulations during your leave period.\n\n" +
        "We wish you a safe journey.\n\n" +
        QR_SECTION +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_long_leave_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Long Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Long Leave request submitted for the period from {{startDate}} to {{endDate}}, for the reason \"{{reason}}\", has been rejected by your parent/guardian.\n\n" +
        "If you require any clarification regarding the decision, kindly coordinate with your parent/guardian directly.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_long_leave_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Long Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Long Leave request for the period from {{startDate}} to {{endDate}}, submitted for the reason \"{{reason}}\", has been reviewed by the Hostel Administration.\n\n" +
        "We regret to inform you that your Long Leave request has not been approved by the Hostel Warden.\n\n" +
        "For any clarification regarding this decision, please reach out to your respective Hostel Warden.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_long_leave",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent/Guardian,\n\n" +
        "Your ward, {{studentName}}, has applied for Long Leave from {{startDate}} to {{endDate}} for the following reason: {{reason}}.\n\n" +
        "Kindly click the link below to review and submit your response online:\n" +
        "{{approvalLink}}\n\n" +
        "Alternatively, you may reply with:\n" +
        "1 {{leaveId}} to approve\n" +
        "2 {{leaveId}} to reject\n\n" +
        "Your response will be automatically recorded.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_submitted_slack_long_leave",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear Hostel Warden,\n\n" +
        "A new Long Leave request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly review the request and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  LATE_ENTRY: [
    {
      code: "leave_approved_email_late_entry",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Entry Request Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Late Entry request for {{startDate}}, submitted for the reason \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "You may enter the hostel within the approved time. Kindly ensure that you comply with all hostel rules and regulations.\n\n" +
        QR_SECTION +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_late_entry_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Entry Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Late Entry request for {{startDate}}, submitted for the reason \"{{reason}}\", has been rejected by your parent/guardian.\n\n" +
        "If you require any clarification regarding the decision, kindly coordinate with your parent/guardian directly.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_late_entry_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Entry Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Late Entry request for {{startDate}}, submitted for the reason \"{{reason}}\", has been reviewed by the Hostel Administration.\n\n" +
        "We regret to inform you that your request has not been approved by the Hostel Warden.\n\n" +
        "For any clarification regarding this decision, please reach out to your respective Hostel Warden.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_late_entry",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent/Guardian,\n\n" +
        "Your ward, {{studentName}}, has requested permission for Late Entry on {{startDate}} for the following reason: {{reason}}.\n\n" +
        "Kindly click the link below to review and submit your response online:\n" +
        "{{approvalLink}}\n\n" +
        "Alternatively, you may reply with:\n" +
        "1 {{leaveId}} to approve\n" +
        "2 {{leaveId}} to reject\n\n" +
        "Your response will be automatically recorded.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_submitted_slack_late_entry",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear Hostel Warden,\n\n" +
        "A new Late Entry request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Date: {{startDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly review the request and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  LATE_STAY_COLLEGE: [
    {
      code: "leave_approved_email_late_stay",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Stay Request Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your request to stay late at college for {{startDate}}, submitted for the reason \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "You may stay on campus as per the approved request. Kindly ensure that you comply with all hostel rules and regulations.\n\n" +
        QR_SECTION +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_late_stay_poc",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Stay Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your request to stay late at college for {{startDate}}, submitted for the reason \"{{reason}}\", has been rejected by the POC.\n\n" +
        "If you require any clarification regarding the decision, kindly coordinate directly with the concerned POC.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_late_stay_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Stay Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your request to stay late at college for {{startDate}}, submitted for the reason \"{{reason}}\", has been reviewed by the Hostel Administration.\n\n" +
        "We regret to inform you that your request has not been approved by the Hostel Warden.\n\n" +
        "For any clarification regarding this decision, please reach out to your respective Hostel Warden.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_submitted_slack_late_stay_poc",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear POC,\n\n" +
        "{{studentName}} ({{rollNumber}}) has requested permission to stay late at college.\n" +
        "Date/Duration: {{startDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly review the request and submit your approval or rejection using the link below:\n" +
        "{{approvalLink}}",
    },
    {
      code: "leave_submitted_slack_late_stay_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear Hostel Warden,\n\n" +
        "A Late Stay at College request approved by the POC is awaiting your review.\n" +
        "Student: {{studentName}} ({{rollNumber}})\n" +
        "Date/Duration: {{startDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly review the request and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  DIFFERENT_HOSTEL: [
    {
      code: "leave_approved_email_diff_hostel",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Different Hostel Request Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your request to stay at a different hostel from {{startDate}} to {{endDate}}, submitted for the reason \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "You may stay at the approved hostel during the approved period. Kindly ensure that you comply with all hostel rules and regulations.\n\n" +
        QR_SECTION +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_diff_hostel_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Different Hostel Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your request to stay at a different hostel from {{startDate}} to {{endDate}}, submitted for the reason \"{{reason}}\", has been rejected by your parent/guardian.\n\n" +
        "If you require any clarification regarding the decision, kindly coordinate with your parent/guardian directly.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_diff_hostel_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Different Hostel Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your request to stay at a different hostel from {{startDate}} to {{endDate}}, submitted for the reason \"{{reason}}\", has been reviewed by the Hostel Administration.\n\n" +
        "We regret to inform you that your request has not been approved by the Hostel Warden.\n\n" +
        "For any clarification regarding this decision, please reach out to your respective Hostel Warden.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_diff_hostel",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent/Guardian,\n\n" +
        "Your ward, {{studentName}}, has requested permission to stay at a different hostel from {{startDate}} to {{endDate}} for the following reason: {{reason}}.\n\n" +
        "Kindly click the link below to review and submit your response online:\n" +
        "{{approvalLink}}\n\n" +
        "Alternatively, you may reply with:\n" +
        "1 {{leaveId}} to approve\n" +
        "2 {{leaveId}} to reject\n\n" +
        "Your response will be automatically recorded.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_submitted_slack_diff_hostel",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear Hostel Warden,\n\n" +
        "A new request to stay at a different hostel has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly review the request and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  HOLIDAY: [
    {
      code: "leave_approved_email_holiday",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Holiday Leave Request Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Holiday Leave request submitted for the period from {{startDate}} to {{endDate}}, for the reason \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "You are requested to adhere to the approved leave schedule and ensure compliance with all hostel rules and regulations during your leave period.\n\n" +
        "We wish you a safe journey.\n\n" +
        QR_SECTION +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_holiday_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Holiday Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Holiday Leave request for the period from {{startDate}} to {{endDate}}, submitted for the reason \"{{reason}}\", has been reviewed by the Hostel Administration.\n\n" +
        "We regret to inform you that your Holiday Leave request has not been approved by the Hostel Warden.\n\n" +
        "For any clarification regarding this decision, please reach out to your respective Hostel Warden.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_submitted_slack_holiday",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear Hostel Warden,\n\n" +
        "A new Holiday Leave request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly review the request and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  INTERNSHIP: [
    {
      code: "leave_approved_email_internship",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Internship Leave Request Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Internship Leave request submitted for the period from {{startDate}} to {{endDate}}, for the reason \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "You are requested to adhere to the approved leave schedule and ensure compliance with all hostel rules and regulations during your leave period.\n\n" +
        "We wish you all the best for your internship.\n\n" +
        QR_SECTION +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_internship_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Internship Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Internship Leave request submitted for the period from {{startDate}} to {{endDate}}, for the reason \"{{reason}}\", has been rejected by your parent/guardian.\n\n" +
        "If you require any clarification regarding the decision, kindly coordinate with your parent/guardian directly.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_internship_poc",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Internship Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Internship Leave request submitted for the period from {{startDate}} to {{endDate}}, for the reason \"{{reason}}\", has been rejected by the POC.\n\n" +
        "If you require any clarification regarding the decision, kindly coordinate directly with the concerned POC.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_internship_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Internship Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Internship Leave request for the period from {{startDate}} to {{endDate}}, submitted for the reason \"{{reason}}\", has been reviewed by the Hostel Administration.\n\n" +
        "We regret to inform you that your Internship Leave request has not been approved by the Hostel Warden.\n\n" +
        "For any clarification regarding this decision, please reach out to your respective Hostel Warden.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_internship",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent/Guardian,\n\n" +
        "Your ward, {{studentName}}, has applied for Internship Leave from {{startDate}} to {{endDate}} for the following reason: {{reason}}.\n\n" +
        "Kindly click the link below to review and submit your response online:\n" +
        "{{approvalLink}}\n\n" +
        "Alternatively, you may reply with:\n" +
        "1 {{leaveId}} to approve\n" +
        "2 {{leaveId}} to reject\n\n" +
        "Your response will be automatically recorded.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_submitted_slack_internship_poc",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear POC,\n\n" +
        "{{studentName}} ({{rollNumber}}) has applied for Internship Leave.\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly review the request and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
    {
      code: "leave_submitted_slack_internship_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear Hostel Warden,\n\n" +
        "A new Internship Leave request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly review the request and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  MARRIAGE_BEREAVEMENT: [
    {
      code: "leave_approved_email_marriage",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Special Leave Request Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Special Leave request submitted for the period from {{startDate}} to {{endDate}}, for the reason \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "You are requested to adhere to the approved leave schedule and ensure compliance with all hostel rules and regulations during your leave period.\n\n" +
        QR_SECTION +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_marriage_policy",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Special Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Special Leave request for the period from {{startDate}} to {{endDate}} has been rejected due to policy violation or missing/invalid supporting documents.\n\n" +
        "If you believe this decision was made in error or require further clarification, kindly contact the Hostel Administration.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_marriage_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Special Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Special Leave request submitted for the period from {{startDate}} to {{endDate}}, for the reason \"{{reason}}\", has been rejected by your parent/guardian.\n\n" +
        "If you require any clarification regarding the decision, kindly coordinate with your parent/guardian directly.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_marriage_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Special Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "This is to inform you that your Special Leave request for the period from {{startDate}} to {{endDate}}, submitted for the reason \"{{reason}}\", has been reviewed by the Hostel Administration.\n\n" +
        "We regret to inform you that your Special Leave request has not been approved by the Hostel Warden.\n\n" +
        "For any clarification regarding this decision, please reach out to your respective Hostel Warden.\n\n" +
        "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_marriage",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent/Guardian,\n\n" +
        "Your ward, {{studentName}} ({{rollNumber}}), has applied for Special Leave ({{leaveCategory}}) from {{startDate}} to {{endDate}} for the following reason:\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly click the link below to review and submit your response online:\n" +
        "{{approvalLink}}\n\n" +
        "Alternatively, you may reply with:\n" +
        "1 {{leaveId}} to approve\n" +
        "2 {{leaveId}} to reject\n\n" +
        "Your response will be automatically recorded.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_submitted_slack_marriage",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear Hostel Warden,\n\n" +
        "A new Special Leave ({{leaveCategory}}) request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly review the request and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],
};

export async function seedNotificationTemplates() {
  let count = 0;

  const allTemplates = Object.values(LEAVE_TYPE_TEMPLATES).flat();

  for (const template of allTemplates) {
    await db.insert(notificationTemplates).values({
      code: template.code,
      eventKey: template.eventKey,
      channel: template.channel as "EMAIL" | "SMS" | "PUSH" | "WEBHOOK" | "SLACK",
      subject: template.subject,
      templateBody: template.templateBody,
      isActive: true,
    }).onConflictDoUpdate({
      target: notificationTemplates.code,
      set: { subject: template.subject, templateBody: template.templateBody, isActive: true, updatedAt: new Date() },
    });
    count++;
  }

  logger.info("Seeded notification templates", { count });
}

export default seedNotificationTemplates;
