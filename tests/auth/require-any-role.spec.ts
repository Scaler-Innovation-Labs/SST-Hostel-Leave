// @ts-nocheck
import { describe, it, expect } from "vitest";
import { requireAnyRole } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/errors";

describe("requireAnyRole", () => {
  it("returns user when has one allowed role", () => {
    const user = { id: "U1", email: "a@x.com", roles: ["POC"] } as any;
    const res = requireAnyRole(user, ["POC", "ADMIN"]);
    expect(res).toEqual(user);
  });

  it("throws AuthorizationError when no allowed roles present", () => {
    const user = { id: "U1", email: "a@x.com", roles: ["STUDENT"] } as any;
    expect(() => requireAnyRole(user, ["POC", "ADMIN"]) ).toThrow(AuthorizationError);
  });
});
