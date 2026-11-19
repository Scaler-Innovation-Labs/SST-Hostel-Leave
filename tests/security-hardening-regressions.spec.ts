import { describe, expect, it, vi } from "vitest";

import { ApiResponse } from "@/lib/api/response";
import { canApproveApproval } from "@/lib/auth/authorization";
import { checkCronAuth } from "@/lib/auth/cron-auth";
import { logger } from "@/lib/logger";

describe("Security & Correctness Hardening Regressions", () => {
  describe("checkCronAuth (constant-time comparison)", () => {
    it("accepts a matching >=32 char CRON_SECRET and rejects mismatches with 401", async () => {
      const original = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "a".repeat(40);
      try {
        const okReq = new Request("http://localhost:3000/api/cron/maintenance", {
          headers: { Authorization: `Bearer ${"a".repeat(40)}` },
        });
        expect(checkCronAuth(okReq)).toBeNull();

        const badReq = new Request("http://localhost:3000/api/cron/maintenance", {
          headers: { Authorization: `Bearer ${"a".repeat(39)}b` },
        });
        const badRes = checkCronAuth(badReq);
        expect(badRes?.status).toBe(401);

        const missingHeaderReq = new Request("http://localhost:3000/api/cron/maintenance");
        expect(checkCronAuth(missingHeaderReq)?.status).toBe(401);
      } finally {
        process.env.CRON_SECRET = original;
      }
    });
  });

  describe("ApiResponse.fromError PII scrubbing", () => {
    it("does not log SQL query params on unhandled database errors", async () => {
      const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
      try {
        const dbErr = Object.assign(new Error("insert failed"), {
          query: 'insert into "users" values ($1, $2)',
          params: ["secret@student.edu", "+919999999999"],
        });
        const res = ApiResponse.fromError(dbErr);
        expect(res.status).toBe(500);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        const loggedMeta = errorSpy.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(loggedMeta).not.toHaveProperty("params");
        expect(JSON.stringify(loggedMeta)).not.toContain("secret@student.edu");
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  describe("canApproveApproval fail-closed guard", () => {
    it("denies approval when both assignedApproverUserId and approverRoleCode are null", () => {
      expect(
        canApproveApproval(
          { assignedApproverUserId: null, approverUserId: null, approverRoleCode: null },
          { id: "U_STUDENT", roles: ["STUDENT"] }
        )
      ).toBe(false);
    });

    it("still allows approval when approverRoleCode matches user role", () => {
      expect(
        canApproveApproval(
          { assignedApproverUserId: null, approverRoleCode: "ADMIN" },
          { id: "U_ADMIN", roles: ["ADMIN"] }
        )
      ).toBe(true);
    });
  });
});
