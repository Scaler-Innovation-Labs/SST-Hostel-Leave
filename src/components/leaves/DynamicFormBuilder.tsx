"use client";

import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";

type FormField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  minLength?: number;
  maxLength?: number;
};

type FormSchema = {
  fields: FormField[];
};

type DynamicFormBuilderProps = {
  schema: FormSchema;
  onChange: (schema: FormSchema) => void;
};

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "tel", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
];

function toKey(label: string | undefined | null): string {
  return (label ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    || `field_${Date.now()}`;
}

export function DynamicFormBuilder({ schema, onChange }: DynamicFormBuilderProps) {
  const fields = schema.fields;

  const updateFields = (newFields: FormField[]) => {
    onChange({ fields: newFields });
  };

  const addField = () => {
    const newField: FormField = {
      key: `field_${fields.length + 1}`,
      label: "New Field",
      type: "text",
      required: false,
    };
    updateFields([...fields, newField]);
  };

  const removeField = (index: number) => {
    updateFields(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target]!, next[index]!];
    updateFields(next);
  };

  const updateField = (index: number, patch: Partial<FormField>) => {
    const next = fields.map((field, i) => {
      if (i !== index) return field;
      const updated = { ...field, ...patch };
      if (patch.label && patch.label !== field.label) {
        updated.key = toKey(patch.label);
      }
      return updated;
    });
    updateFields(next);
  };

  const addOption = (index: number) => {
    const field = fields[index]!;
    const options = field.options ?? [];
    updateField(index, { options: [...options, `option_${options.length + 1}`] });
  };

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    const field = fields[fieldIndex]!;
    updateField(fieldIndex, {
      options: (field.options ?? []).filter((_, i) => i !== optionIndex),
    });
  };

  const updateOption = (fieldIndex: number, optionIndex: number, value: string) => {
    const field = fields[fieldIndex]!;
    const options = [...(field.options ?? [])];
    options[optionIndex] = value;
    updateField(fieldIndex, { options });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          {fields.length} field{fields.length !== 1 ? "s" : ""} configured
        </p>
        <button
          type="button"
          onClick={addField}
          className="flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="size-3" /> Add field
        </button>
      </div>

      {fields.length === 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No form fields configured. Add at least one field.
        </p>
      )}

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div
            key={`${field.key}-${index}`}
            className="rounded-xl border bg-card p-4 space-y-3"
          >
            {/* Field header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="size-4 text-muted-foreground/50" />
                <span className="text-xs font-medium text-muted-foreground">
                  Field {index + 1}
                </span>
                {field.required && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800">
                    Required
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveField(index, -1)}
                  disabled={index === 0}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveField(index, 1)}
                  disabled={index === fields.length - 1}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Field properties */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block font-medium">Label</span>
                <input
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </label>

              <label className="block text-xs">
                <span className="mb-1 block font-medium">Field key</span>
                <input
                  value={field.key}
                  onChange={(e) => updateField(index, { key: e.target.value })}
                  className="h-8 w-full rounded-md border bg-background px-2 font-mono text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block text-xs">
                <span className="mb-1 block font-medium">Type</span>
                <select
                  value={field.type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    const patch: Partial<FormField> = { type: newType };
                    if (newType !== "select") patch.options = undefined;
                    if (newType !== "text" && newType !== "textarea") {
                      patch.minLength = undefined;
                      patch.maxLength = undefined;
                    }
                    updateField(index, patch);
                  }}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  {FIELD_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </select>
              </label>

              {field.type === "text" && (
                <>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium">Min length</span>
                    <input
                      type="number"
                      min={0}
                      value={field.minLength ?? ""}
                      onChange={(e) => updateField(index, { minLength: e.target.value ? Number(e.target.value) : undefined })}
                      className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium">Max length</span>
                    <input
                      type="number"
                      min={0}
                      value={field.maxLength ?? ""}
                      onChange={(e) => updateField(index, { maxLength: e.target.value ? Number(e.target.value) : undefined })}
                      className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                    />
                  </label>
                </>
              )}

              <label className="block text-xs">
                <span className="mb-1 block font-medium">Placeholder</span>
                <input
                  value={field.placeholder ?? ""}
                  onChange={(e) => updateField(index, { placeholder: e.target.value || undefined })}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </label>

              <label className="flex items-center gap-2 text-xs pt-5">
                <input
                  type="checkbox"
                  checked={field.required ?? false}
                  onChange={(e) => updateField(index, { required: e.target.checked })}
                  className="rounded"
                />
                Required
              </label>
            </div>

            {/* Options for select type */}
            {field.type === "select" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">Options</span>
                  <button
                    type="button"
                    onClick={() => addOption(index)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    + Add option
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(field.options ?? []).map((option, optIndex) => (
                    <span key={optIndex} className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-0.5">
                      <input
                        value={option}
                        onChange={(e) => updateOption(index, optIndex, e.target.value)}
                        className="w-20 bg-transparent text-[11px] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(index, optIndex)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}

export type { FormField, FormSchema };
export default DynamicFormBuilder;
