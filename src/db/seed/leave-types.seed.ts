import {
  leaveTypes,
  workflowDefinitions,
} from "@/db";
import type { db } from "@/lib/db";
import { LEAVE_CATEGORY } from "@/constants/leave/leave-category";

type LeaveTypeSeed = {
  code: string;
  name: string;
  category: string;
  workflowCode: string;
  qrMode: string;
  allowExtensions: boolean;
  maxExtensionCount?: number;
  formFields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    minLength?: number;
    maxLength?: number;
  }>;
  requiredDocuments?: Array<{
    code: string;
    label: string;
    required: boolean;
    acceptedTypes: string[];
  }>;
};

const LEAVE_TYPES: LeaveTypeSeed[] = [
  {
    code: "RE_EXAM",
    name: "Re Exam",
    category: LEAVE_CATEGORY.HOSTEL,
    workflowCode: "RE_EXAM",
    qrMode: "NONE",
    allowExtensions: false,
    formFields: [
      { key: "subject", label: "Subject", type: "text", required: true, minLength: 2, maxLength: 200 },
      { key: "examDate", label: "Exam Date", type: "date", required: true },
      { key: "examHall", label: "Exam Hall", type: "text", required: true, minLength: 2, maxLength: 200 },
    ],
  },
  {
    code: "LONG_LEAVE",
    name: "Long Leave",
    category: LEAVE_CATEGORY.HOSTEL,
    workflowCode: "LONG_LEAVE",
    qrMode: "BOTH",
    allowExtensions: true,
    maxExtensionCount: 2,
    formFields: [
      { key: "destination", label: "Destination", type: "text", required: true, minLength: 2, maxLength: 200 },
      { key: "reason", label: "Reason", type: "textarea", required: true, minLength: 5, maxLength: 500 },
    ],
  },
  {
    code: "LATE_ENTRY",
    name: "Late Entry",
    category: LEAVE_CATEGORY.HOSTEL,
    workflowCode: "LATE_ENTRY",
    qrMode: "RETURN_ONLY",
    allowExtensions: false,
    formFields: [
      { key: "reason", label: "Reason", type: "textarea", required: true, minLength: 5, maxLength: 500 },
    ],
  },
  {
    code: "LATE_STAY_COLLEGE",
    name: "Late Stay At College",
    category: LEAVE_CATEGORY.HOSTEL,
    workflowCode: "LATE_STAY_COLLEGE",
    qrMode: "OPTIONAL",
    allowExtensions: false,
    formFields: [
      { key: "reason", label: "Reason", type: "textarea", required: true, minLength: 5, maxLength: 500 },
    ],
  },
  {
    code: "DIFFERENT_HOSTEL",
    name: "Staying At Different Hostel",
    category: LEAVE_CATEGORY.HOSTEL,
    workflowCode: "DIFFERENT_HOSTEL",
    qrMode: "BOTH",
    allowExtensions: true,
    maxExtensionCount: 2,
    formFields: [
      { key: "destinationHostel", label: "Destination Hostel", type: "text", required: true, minLength: 2, maxLength: 200 },
      { key: "reason", label: "Reason", type: "textarea", required: true, minLength: 5, maxLength: 500 },
    ],
  },
  {
    code: "HOLIDAY",
    name: "Holidays",
    category: LEAVE_CATEGORY.HOSTEL,
    workflowCode: "HOLIDAY",
    qrMode: "BOTH",
    allowExtensions: false,
    formFields: [
      { key: "destination", label: "Destination", type: "text", required: true, minLength: 2, maxLength: 200 },
    ],
  },
  {
    code: "INTERNSHIP",
    name: "Internships",
    category: LEAVE_CATEGORY.HOSTEL,
    workflowCode: "INTERNSHIP",
    qrMode: "BOTH",
    allowExtensions: true,
    maxExtensionCount: 2,
    formFields: [
      { key: "company", label: "Company", type: "text", required: true, minLength: 2, maxLength: 200 },
      { key: "companyAddress", label: "Company Address", type: "text", required: true, minLength: 5, maxLength: 500 },
      { key: "mentor", label: "Mentor", type: "text", required: true, minLength: 2, maxLength: 200 },
      { key: "internshipStart", label: "Internship Start", type: "date", required: true },
      { key: "internshipEnd", label: "Internship End", type: "date", required: true },
    ],
    requiredDocuments: [
      { code: "OFFER_LETTER", label: "Offer Letter", required: true, acceptedTypes: ["PDF", "DOCX", "JPG"] },
    ],
  },
  {
    code: "MARRIAGE_BEREAVEMENT",
    name: "Marriage / Relative Expired",
    category: LEAVE_CATEGORY.HOSTEL,
    workflowCode: "MARRIAGE_BEREAVEMENT",
    qrMode: "NONE",
    allowExtensions: false,
    formFields: [
      { key: "relation", label: "Relation", type: "text", required: true, minLength: 2, maxLength: 200 },
      { key: "reason", label: "Reason", type: "textarea", required: true, minLength: 5, maxLength: 500 },
    ],
  },
];

export async function seedLeaveTypes(
  database: typeof db
) {
  const workflows =
    await database
      .select()
      .from(workflowDefinitions);

  const workflowMap = new Map(
    workflows.map((workflow) => [
      workflow.code,
      workflow.id,
    ])
  );

  await database
    .insert(leaveTypes)
    .values(
      LEAVE_TYPES.map((lt) => ({
        code: lt.code,
        name: lt.name,
        category: lt.category as "HOME_PASS" | "MEDICAL" | "LOCAL_OUTING" | "NIGHT_OUT" | "ACADEMIC" | "HOSTEL",
        workflowMode: "HOSTEL" as const,
        defaultWorkflowId: workflowMap.get(lt.workflowCode),
        qrMode: lt.qrMode as "NONE" | "EXIT_ONLY" | "RETURN_ONLY" | "BOTH" | "OPTIONAL",
        allowExtensions: lt.allowExtensions,
        maxExtensionCount: lt.maxExtensionCount ?? null,
        formSchema: { fields: lt.formFields },
        requiredDocuments: lt.requiredDocuments ? { documents: lt.requiredDocuments } : null,
      }))
    )
    .onConflictDoNothing();
}
