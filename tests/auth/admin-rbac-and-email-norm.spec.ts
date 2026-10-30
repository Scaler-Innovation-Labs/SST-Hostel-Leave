import { describe, expect, it } from "vitest";

import { hasPermission, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";
import { createUserSchema } from "@/dto/user/create-user.dto";
import { updateUserSchema } from "@/dto/user/update-user.dto";
import { createStudentSchema } from "@/dto/student/create-student.dto";
import { optionalEmail } from "@/services/shared/bulk-row-validation";

describe("Admin and Super Admin Permissions RBAC cross-check", () => {
  it("ensures ADMIN does not have workflow:write permission", () => {
    expect(ROLE_PERMISSIONS[ROLES.ADMIN]).not.toContain("workflow:write");
    expect(hasPermission([ROLES.ADMIN], "workflow:write")).toBe(false);
  });

  it("ensures ADMIN has legitimate operational permissions only", () => {
    expect(ROLE_PERMISSIONS[ROLES.ADMIN]).toEqual([
      "dashboard:read",
      "leaves:read",
      "workflow:read",
      "qr:read",
      "qr:write",
      "analytics:read",
    ]);
  });

  it("ensures SUPER_ADMIN has full permissions including workflow:write and user management", () => {
    expect(ROLE_PERMISSIONS[ROLES.SUPER_ADMIN]).toContain("workflow:write");
    expect(ROLE_PERMISSIONS[ROLES.SUPER_ADMIN]).toContain("users:write");
    expect(ROLE_PERMISSIONS[ROLES.SUPER_ADMIN]).toContain("users:read");
    expect(hasPermission([ROLES.SUPER_ADMIN], "workflow:write")).toBe(true);
    expect(hasPermission([ROLES.SUPER_ADMIN], "users:write")).toBe(true);
  });
});

describe("Email normalization sanity checks", () => {
  it("normalizes user creation email to lowercase", () => {
    const parsed = createUserSchema.parse({
      fullName: "Test User",
      email: "User.MixedCase@SST.Scaler.COM",
      roleCodes: [ROLES.STUDENT],
    });
    expect(parsed.email).toBe("user.mixedcase@sst.scaler.com");
  });

  it("normalizes user update email to lowercase", () => {
    const parsed = updateUserSchema.parse({
      email: "Shubham.Behl@Scaler.COM",
    });
    expect(parsed.email).toBe("shubham.behl@scaler.com");
  });

  it("normalizes student and parent emails to lowercase", () => {
    const parsed = createStudentSchema.parse({
      fullName: "Student Test",
      email: "Student.One@Scaler.COM",
      rollNumber: "26BCS99999",
      academicGroupId: "00000000-0000-0000-0000-000000000000",
      parentName: "Parent Test",
      parentPhone: "+919876543210",
      parentEmail: "Parent.Email@Example.COM",
      parentRelationship: "Father",
    });
    expect(parsed.email).toBe("student.one@scaler.com");
    expect(parsed.parentEmail).toBe("parent.email@example.com");
  });

  it("normalizes bulk row optionalEmail helper to lowercase", () => {
    const normalized = optionalEmail("Shubham.Behl@Scaler.com", "email", 0);
    expect(normalized).toBe("shubham.behl@scaler.com");
  });
});
