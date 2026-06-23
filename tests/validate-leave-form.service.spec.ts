import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors";
import { validateLeaveSubmittedForm } from "@/services/leave/validate-leave-form.service";

const schema = {
  fields: [
    { key: "destination", label: "Destination", type: "text", required: true, minLength: 2 },
    { key: "transport", label: "Transport", type: "select", options: ["Bus", "Train"] },
  ],
};

describe("validateLeaveSubmittedForm", () => {
  it("returns only schema-defined normalized values", () => {
    expect(validateLeaveSubmittedForm(schema, { destination: "Home", transport: "Bus" })).toEqual({
      destination: "Home",
      transport: "Bus",
    });
  });

  it("rejects missing required fields", () => {
    expect(() => validateLeaveSubmittedForm(schema, {})).toThrow(ValidationError);
  });

  it("rejects unknown fields", () => {
    expect(() => validateLeaveSubmittedForm(schema, { destination: "Home", hidden: "value" })).toThrow(ValidationError);
  });

  it("supports legacy string field schemas", () => {
    expect(validateLeaveSubmittedForm({ fields: ["destination"] }, { destination: "Home" })).toEqual({ destination: "Home" });
  });
});
