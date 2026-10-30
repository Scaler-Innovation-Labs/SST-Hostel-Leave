import { describe, it, expect } from "vitest";
import { readBoundedJson } from "@/lib/api/request-body";
import { ValidationError } from "@/lib/errors";

describe("readBoundedJson", () => {
  it("parses valid JSON successfully", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "value", num: 42 }),
    });

    const parsed = await readBoundedJson(req);
    expect(parsed).toEqual({ key: "value", num: 42 });
  });

  it("throws ValidationError if declared content-length exceeds maxBytes", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "200",
      },
      body: JSON.stringify({ a: 1 }),
    });

    await expect(readBoundedJson(req, 100)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError if actual payload length exceeds maxBytes", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: "a".repeat(150) }),
    });

    await expect(readBoundedJson(req, 100)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when JSON is malformed", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json",
    });

    await expect(readBoundedJson(req)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError on empty body by default", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
    });

    await expect(readBoundedJson(req)).rejects.toThrow(ValidationError);
  });

  it("returns empty object on empty body when allowEmpty is true", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
    });

    const result = await readBoundedJson(req, { allowEmpty: true });
    expect(result).toEqual({});
  });

  it("returns empty object on whitespace-only body when allowEmpty is true with custom maxBytes", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "   \n\t  ",
    });

    const result = await readBoundedJson(req, 500, { allowEmpty: true });
    expect(result).toEqual({});
  });
});
