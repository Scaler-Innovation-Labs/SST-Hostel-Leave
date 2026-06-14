import type { UseFormRegister } from "react-hook-form";

import type { CreateLeaveDto } from "@/dto/leave/create-leave.dto";
import type { LeaveFormSchema } from "@/types/leave/leave-form-schema";

export function DynamicLeaveFields({ schema, register }: { schema: LeaveFormSchema; register: UseFormRegister<CreateLeaveDto> }) {
  if (schema.fields.length === 0) return null;
  return <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
    <h3 className="mb-4 text-base font-semibold">Additional information</h3>
    <div className="space-y-4">{schema.fields.map((field) => {
      const registration = register(`submittedForm.${field.key}`, {
        setValueAs: field.type === "checkbox" ? (value) => Boolean(value) : undefined,
      });
      const common = { ...registration, required: field.required, placeholder: field.placeholder, minLength: field.minLength, maxLength: field.maxLength, className: "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" };
      return <label key={field.key} className="block text-sm"><span className="mb-1 block font-medium">{field.label}{field.required ? " *" : ""}</span>
        {field.type === "textarea" ? <textarea {...common} rows={3} /> :
          field.type === "select" ? <select {...common}><option value="">Select...</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select> :
          field.type === "checkbox" ? <input {...registration} type="checkbox" className="size-4" /> :
          <input {...common} type={field.type} />}
      </label>;
    })}</div>
  </div>;
}
