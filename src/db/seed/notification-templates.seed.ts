import { NOTIFICATION_CHANNEL } from "@/constants/notification/notification-channel";
import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event";
import { leaveTypes as leaveTypesTable, notificationTemplates } from "@/db";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

type TemplateSeed = {
  code: string;
  eventKey: string;
  channel: string;
  subject: string | null;
  templateBody: string;
};

/**
 * Approval emails never carry QR content of any kind (no image, no QR text,
 * no dashboard link) — the QR itself lives behind login. The only link
 * block is "View Leave Details", and it is included ONLY for leave types
 * with a QR flow (qrMode !== "NONE"). Keep in sync with leave-types.seed.ts:
 * EXAM_LEAVE and ATTENDANCE_EXCEPTION have qrMode NONE and get no link
 * block at all.
 */
const LEAVE_LINK_SECTION =
  "View Leave Details: {{leaveUrl}}\n\n";

function formatEmailTemplateBody(body: string): string {
  const paragraphs = body.split("\n\n");
  return paragraphs
    .map((p) => {
      const lines = p.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length === 0) return "";
      return `<p>${lines.join("<br>")}</p>`;
    })
    .filter((p) => p.length > 0)
    .join("\n");
}

function formatTemplateBody(template: TemplateSeed): string {
  return template.channel === NOTIFICATION_CHANNEL.EMAIL
    ? formatEmailTemplateBody(template.templateBody)
    : template.templateBody;
}

const NO_QR_FLOW = new Set(["EXAM_LEAVE", "ATTENDANCE_EXCEPTION"]);

function qrSectionFor(leaveTypeCode: string): string {
  return NO_QR_FLOW.has(leaveTypeCode) ? "" : LEAVE_LINK_SECTION;
}

const LEAVE_TYPE_TEMPLATES: Record<string, TemplateSeed[]> = {
  EXAM_LEAVE: [
    {
      code: "leave_approved_email_exam_leave",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Leave During Examination Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Leave During Examination for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "Please follow the approved leave dates and observe all hostel rules while you are away.\n\n" +
        "<strong>Please note:</strong> This approval covers the Warden verification component only. For the remaining steps of your re-exam exemption process, please refer to the Student Policy and submit your request via this form: <a href=\"https://docs.google.com/forms/d/e/1FAIpQLScPUfow-KEoG8auclaYeb8F4E5_tgTALOFdwA-1jPk0jlHSzA/viewform\">https://docs.google.com/forms/d/e/1FAIpQLScPUfow-KEoG8auclaYeb8F4E5_tgTALOFdwA-1jPk0jlHSzA/viewform</a>\n\n" +
        "We wish you the very best for your examination.\n\n" +
        qrSectionFor("EXAM_LEAVE") +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_exam_leave_policy",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Leave During Examination Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Leave During Examination request for {{startDate}} to {{endDate}} could not be approved, as the requested dates do not match the approved examination schedule under the hostel leave policy.\n\n" +
        "{{reviewCommentsSection}}" +
        "If you believe this is an error or need any clarification, please contact the Hostel Administration.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_exam_leave_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Leave During Examination Request Declined by Parent/Guardian",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Leave During Examination request for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been declined by your parent/guardian.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please speak with your parent/guardian directly.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_exam_leave_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Leave During Examination Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Leave During Examination request for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been reviewed by the Hostel Administration and has not been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please reach out to your Hostel Warden.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_exam_leave",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent,{{StudentApprovalName}} has applied for a Leave. Kindly click the link to review: {{approvalLink}} -Scaler School of Technology",
    },

    {
      code: "leave_submitted_slack_exam_leave",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear Hostel Warden,\n\n" +
        "A new Leave During Examination request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
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
      subject: "Long Leave Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Long Leave for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "Please follow the approved leave dates and observe all hostel rules during your leave.\n\n" +
        "<strong>Please note:</strong> This approval covers your hostel leave only. It does not exempt you from any classes, examinations, exam- or class-related requirements, or other academic obligations during this period. For any leave or exemption from academic requirements, please refer to the Student Policy and follow the process laid out there.\n\n" +
        "We wish you a safe journey.\n\n" +
        qrSectionFor("LONG_LEAVE") +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_long_leave_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Long Leave Request Declined by Parent/Guardian",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Long Leave request for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been declined by your parent/guardian.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please speak with your parent/guardian directly.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_long_leave_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Long Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Long Leave request for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been reviewed by the Hostel Administration and has not been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please reach out to your Hostel Warden.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_long_leave",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent,{{StudentApprovalName}} has applied for a Leave. Kindly click the link to review: {{approvalLink}} -Scaler School of Technology",
    },

    {
      code: "leave_submitted_slack_long_leave",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear {{campus}} Hostel Warden,\n\n" +
        "A new Long Leave request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Please review and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  LATE_ENTRY: [
    {
      code: "leave_approved_email_late_entry",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Entry Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Late Entry request for {{startDate}}, submitted for \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "You may enter the hostel within the approved time. Please observe all hostel rules.\n\n" +
        qrSectionFor("LATE_ENTRY") +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_late_entry_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Entry Request Declined by Parent/Guardian",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Late Entry request for {{startDate}}, submitted for \"{{reason}}\", has been declined by your parent/guardian.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please speak with your parent/guardian directly.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_late_entry_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Entry Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Late Entry request for {{startDate}}, submitted for \"{{reason}}\", has been reviewed by the Hostel Administration and has not been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please reach out to your Hostel Warden.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_late_entry",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent,{{StudentApprovalName}} has applied for a Leave. Kindly click the link to review: {{approvalLink}} -Scaler School of Technology",
    },

    {
      code: "leave_submitted_slack_late_entry",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear {{campus}} Hostel Warden,\n\n" +
        "A new Late Entry request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Date: {{startDate}}\n" +
        "Expected Entry Time: {{expectedEntryTime}}\n" +
        "Reason: {{reason}}\n\n" +
        "Please review and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  LATE_STAY_COLLEGE: [
    {
      code: "leave_approved_email_late_stay",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Stay at College Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your request to stay late at college for {{startDate}}, submitted for \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "You may stay on campus as per the approved request. Please observe all hostel rules.\n\n" +
        qrSectionFor("LATE_STAY_COLLEGE") +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_late_stay_poc",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Stay Request Declined",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your request to stay late at college for {{startDate}}, submitted for \"{{reason}}\", has been declined by {{pocName}}.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please coordinate directly with the concerned POC.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_late_stay_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Late Stay at College Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your request to stay late at college for {{startDate}}, submitted for \"{{reason}}\", has been reviewed by the Hostel Administration and has not been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please reach out to your Hostel Warden.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_submitted_slack_late_stay_poc",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Hello,\n\n" +
        "{{studentName}} ({{rollNumber}}) has requested permission to stay late at college.\n" +
        "Date/Duration: {{startDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Please review and submit your approval or rejection using the link below:\n" +
        "{{approvalLink}}",
    },
    {
      code: "leave_submitted_slack_late_stay_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear {{campus}} Hostel Warden,\n\n" +
        "A Late Stay at College request approved by the POC is awaiting your review.\n" +
        "Student: {{studentName}} ({{rollNumber}})\n" +
        "Date/Duration: {{startDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Please review and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  DIFFERENT_HOSTEL: [
    {
      code: "leave_approved_email_diff_hostel",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Stay at Different Hostel Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your request to stay at a different hostel from {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "You may stay at the approved hostel for the approved period. Please observe all hostel rules.\n\n" +
        qrSectionFor("DIFFERENT_HOSTEL") +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_diff_hostel_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Different Hostel Request Declined by Parent/Guardian",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your request to stay at a different hostel from {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been declined by your parent/guardian.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please speak with your parent/guardian directly.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_diff_hostel_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Different Hostel Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your request to stay at a different hostel from {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been reviewed by the Hostel Administration and has not been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please reach out to your Hostel Warden.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_diff_hostel",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent,{{StudentApprovalName}} has applied for a Leave. Kindly click the link to review: {{approvalLink}} -Scaler School of Technology",
    },
    {
      code: "leave_submitted_slack_diff_hostel",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear {{campus}} Hostel Warden,\n\n" +
        "A new request to stay at a different hostel has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Duration: {{startDate}} to {{endDate}}\n" +
        "Requested Hostel: {{hostelName}}\n" +
        "Reason: {{reason}}\n\n" +
        "Please review and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  HOLIDAY: [
    {
      code: "leave_approved_email_holiday",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Holiday Leave Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Holiday Leave for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "Please follow the approved leave dates and observe all hostel rules during your leave.\n\n" +
        "We wish you a safe journey.\n\n" +
        qrSectionFor("HOLIDAY") +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_holiday_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Holiday Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Holiday Leave request for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been reviewed by the Hostel Administration and has not been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please reach out to your Hostel Warden.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_submitted_slack_holiday",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear {{campus}} Hostel Warden,\n\n" +
        "A new Holiday Leave request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Please review and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  INTERNSHIP: [
    {
      code: "leave_approved_email_internship",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Internship Hostel Leave Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Internship Leave for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "Please follow the approved leave dates and observe all hostel rules during your leave.\n\n" +
        "<strong>Please note:</strong> This approval covers your hostel leave only. It does not grant academic leave or exempt you from any classes, examinations, or academic requirements during your internship. For academic leave or exemptions, please refer to the Student Policy and follow the process laid out there.\n\n" +
        "We wish you the very best for your internship.\n\n" +
        qrSectionFor("INTERNSHIP") +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_internship_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Internship Leave Request Declined by Parent/Guardian",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Internship Leave request for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been declined by your parent/guardian.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please speak with your parent/guardian directly.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_internship_poc",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Internship Leave Request Declined",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Internship Leave request for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been declined by {{pocName}}.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please coordinate directly with the concerned POC.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_internship_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Internship Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Internship Leave request for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been reviewed by the Hostel Administration and has not been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please reach out to your Hostel Warden.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_internship",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent,{{StudentApprovalName}} has applied for a Leave. Kindly click the link to review: {{approvalLink}} -Scaler School of Technology",
    },
    {
      code: "leave_submitted_slack_internship_poc",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Hello,\n\n" +
        "{{studentName}} ({{rollNumber}}) has applied for Internship Leave.\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Please review and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
    {
      code: "leave_submitted_slack_internship_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear {{campus}} Hostel Warden,\n\n" +
        "A new Internship Leave request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Please review and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],

  ATTENDANCE_EXCEPTION: [
    {
      code: "leave_approved_email_attendance_exception",
      eventKey: NOTIFICATION_EVENT.LEAVE_APPROVED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Special Leave Approved",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Special Leave for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "Please follow the approved leave dates and observe all hostel rules during your leave.\n\n" +
        "<strong>Please note:</strong> This approval covers the Warden verification component only. For the remaining steps of your attendance exemption process, please refer to the Student Policy and submit your request via this form: <a href=\"https://docs.google.com/forms/d/1YWPF5AbXSV8D50WjpCcsP8l5AvV1ZAnXsnYAugM86aA/viewform?ts=67b573db&edit_requested=true#responses\">https://docs.google.com/forms/d/1YWPF5AbXSV8D50WjpCcsP8l5AvV1ZAnXsnYAugM86aA/viewform?ts=67b573db&edit_requested=true#responses</a>\n\n" +
        qrSectionFor("ATTENDANCE_EXCEPTION") +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_attendance_exception_policy",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Special Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Special Leave request for {{startDate}} to {{endDate}} could not be approved, as a policy requirement was not met or the required supporting documents were missing or invalid.\n\n" +
        "{{reviewCommentsSection}}" +
        "If you believe this is an error or need any clarification, please contact the Hostel Administration.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_attendance_exception_parent",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Special Leave Request Declined by Parent/Guardian",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Special Leave request for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been declined by your parent/guardian.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please speak with your parent/guardian directly.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "leave_rejected_email_attendance_exception_admin",
      eventKey: NOTIFICATION_EVENT.LEAVE_REJECTED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      subject: "Special Leave Request Rejected",
      templateBody:
        "Dear {{studentName}},\n\n" +
        "Your Special Leave request for {{startDate}} to {{endDate}}, submitted for \"{{reason}}\", has been reviewed by the Hostel Administration and has not been approved by the Hostel Warden.\n\n" +
        "{{reviewCommentsSection}}" +
        "For any clarification, please reach out to your Hostel Warden.\n\n" +
        "Regards,\nHostel Administration\nScaler School of Technology",
    },
    {
      code: "parent_approval_requested_sms_attendance_exception",
      eventKey: NOTIFICATION_EVENT.PARENT_APPROVAL_REQUESTED,
      channel: NOTIFICATION_CHANNEL.SMS,
      subject: null,
      templateBody:
        "Dear Parent,{{StudentApprovalName}} has applied for a Leave. Kindly click the link to review: {{approvalLink}} -Scaler School of Technology",
    },
    {
      code: "leave_submitted_slack_attendance_exception_poc",
      eventKey: NOTIFICATION_EVENT.LEAVE_POC_REVIEW_REQUIRED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear POC,\n\n" +
        "A Special Leave ({{leaveCategory}}) request approved by the parent is awaiting your review.\n" +
        "Student: {{studentName}} ({{rollNumber}})\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Kindly review the request and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
    {
      code: "leave_submitted_slack_attendance_exception",
      eventKey: NOTIFICATION_EVENT.LEAVE_SUBMITTED,
      channel: NOTIFICATION_CHANNEL.SLACK,
      subject: null,
      templateBody:
        "Dear {{campus}} Hostel Warden,\n\n" +
        "A new Special Leave ({{leaveCategory}}) request has been submitted by {{studentName}} ({{rollNumber}}).\n" +
        "Leave Duration: {{startDate}} to {{endDate}}\n" +
        "Reason: {{reason}}\n\n" +
        "Please review and approve or reject it using the link below:\n" +
        "{{approvalLink}}",
    },
  ],
};

export { GLOBAL_TEMPLATES,LEAVE_TYPE_TEMPLATES };

// Global templates apply to every leave type (leave_type_id = NULL). OVERDUE
// alerts go to the student only: the student checked out but has not returned
// by the leave end date, and is asked to extend the leave.
const GLOBAL_TEMPLATES: TemplateSeed[] = [
  {
    code: "leave_overdue_email_student",
    eventKey: NOTIFICATION_EVENT.LEAVE_OVERDUE,
    channel: NOTIFICATION_CHANNEL.EMAIL,
    subject: "Your Leave is Overdue — Please Extend or Return",
    templateBody:
      "Dear {{studentName}},\n\n" +
      "Your {{leaveTypeName}} leave for the period from {{startDate}} to {{endDate}} is now overdue. You checked out of the hostel for this leave but have not yet checked back in.\n\n" +
      "Please return to the hostel immediately, or extend your leave so your absence remains authorized. Extensions can be requested from your leave details page.\n\n" +
      "Your QR pass remains active for checking back in.\n\n" +
      "If you require any assistance, kindly contact the Hostel Administration.\n\n" +
      "Thank you.\nRegards,\nHostel Administration\nScaler School of Technology",
  },
];

export async function seedNotificationTemplates() {
  let count = 0;

  const leaveTypeRows = await db
    .select({ id: leaveTypesTable.id, code: leaveTypesTable.code })
    .from(leaveTypesTable);
  const leaveTypeIdByCode = new Map(leaveTypeRows.map((lt) => [lt.code, lt.id]));

  for (const [leaveTypeCode, templates] of Object.entries(LEAVE_TYPE_TEMPLATES)) {
    const leaveTypeId = leaveTypeIdByCode.get(leaveTypeCode) ?? null;

    for (const template of templates) {
      await db.insert(notificationTemplates).values({
        code: template.code,
        eventKey: template.eventKey,
        channel: template.channel as "EMAIL" | "SMS" | "SLACK",
        leaveTypeId,
        subject: template.subject,
        templateBody: formatTemplateBody(template),
        isActive: true,
      }).onConflictDoUpdate({
        target: notificationTemplates.code,
        set: {
          subject: template.subject,
          templateBody: formatTemplateBody(template),
          leaveTypeId,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      count++;
    }
  }

  for (const template of GLOBAL_TEMPLATES) {
    await db.insert(notificationTemplates).values({
      code: template.code,
      eventKey: template.eventKey,
      channel: template.channel as "EMAIL" | "SMS" | "SLACK",
      leaveTypeId: null,
      subject: template.subject,
      templateBody: formatTemplateBody(template),
      isActive: true,
    }).onConflictDoUpdate({
      target: notificationTemplates.code,
      set: {
        subject: template.subject,
        templateBody: formatTemplateBody(template),
        leaveTypeId: null,
        isActive: true,
        updatedAt: new Date(),
      },
    });
    count++;
  }

  logger.info("Seeded notification templates", { count });
}

export default seedNotificationTemplates;
