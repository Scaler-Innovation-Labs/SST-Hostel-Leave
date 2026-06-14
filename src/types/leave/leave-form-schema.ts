export const LEAVE_FORM_FIELD_TYPES = ["text", "textarea", "tel", "email", "number", "select", "checkbox", "date"] as const;
export type LeaveFormFieldType = (typeof LEAVE_FORM_FIELD_TYPES)[number];

export type LeaveFormField = {
  key: string;
  label: string;
  type: LeaveFormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  minLength?: number;
  maxLength?: number;
};

export type LeaveFormSchema = {
  fields: LeaveFormField[];
};
