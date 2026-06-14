// @ts-nocheck
import { describe, it, expect } from "vitest";
import { requireRole } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/errors";

describe("requireRole", () => {
  it("does not throw when user has role", () => {
    const user = { id: "U1", email: "a@x.com", roles: ["ADMIN"] } as any;
    expect(() => requireRole(user, "ADMIN")).not.toThrow();
  });

  it("throws AuthorizationError when missing role", () => {
    const user = { id: "U1", email: "a@x.com", roles: ["STUDENT"] } as any;
    expect(() => requireRole(user, "ADMIN")).toThrow(AuthorizationError);
  });
});
