import { describe, expect, it } from "vitest";

import { GET as getDocsHandler } from "@/app/api/docs/route";
import { GET as getOpenApiJsonHandler } from "@/app/api/v1/openapi.json/route";
import { getOpenApiDocument } from "@/lib/openapi/spec";

describe("OpenAPI Specification & Scalar Docs", () => {
  it("generates a valid OpenAPI 3.1.0 document", () => {
    const doc = getOpenApiDocument();

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toContain("SST Hostel Leave");
    expect(doc.info.version).toBe("1.0.0");
    expect(doc.paths).toBeDefined();
    expect(doc.components?.securitySchemes).toHaveProperty("BearerAuth");
    expect(doc.tags?.length).toBe(10);
  });

  it("documents comprehensive production operations across all 10 domains (>45 operations)", () => {
    const doc = getOpenApiDocument();
    const paths = doc.paths ?? {};

    let totalOperations = 0;
    const methods = ["get", "post", "put", "delete", "patch"] as const;

    for (const pathItem of Object.values(paths)) {
      for (const m of methods) {
        if ((pathItem as any)[m]) {
          totalOperations++;
        }
      }
    }

    expect(totalOperations).toBe(58);

    // 1. Auth & Identity
    expect(paths["/api/v1/me/roles"]?.get).toBeDefined();
    expect(paths["/api/v1/me/active-role"]?.get).toBeDefined();
    expect(paths["/api/v1/me/active-role"]?.post).toBeDefined();

    // 2. Students & Contacts
    expect(paths["/api/v1/students/contacts"]?.get).toBeDefined();
    expect(paths["/api/v1/students"]?.get).toBeDefined();
    expect(paths["/api/v1/students"]?.post).toBeDefined();
    expect(paths["/api/v1/students/{id}"]?.get).toBeDefined();
    expect(paths["/api/v1/students/bulk"]?.post).toBeDefined();

    // 3. Leaves & Documents & Questions
    expect(paths["/api/v1/leaves"]?.post).toBeDefined();
    expect(paths["/api/v1/leaves"]?.get).toBeDefined();
    expect(paths["/api/v1/leaves/{id}"]?.get).toBeDefined();
    expect(paths["/api/v1/leaves/{id}/approve"]?.post).toBeDefined();
    expect(paths["/api/v1/leaves/{id}/cancel"]?.post).toBeDefined();
    expect(paths["/api/v1/leaves/{id}/documents"]?.get).toBeDefined();
    expect(paths["/api/v1/leaves/{id}/documents"]?.post).toBeDefined();
    expect(paths["/api/v1/leaves/{id}/questions"]?.get).toBeDefined();
    expect(paths["/api/v1/leaves/{id}/questions/{questionId}/answer"]?.post).toBeDefined();

    // 4. Leave Extensions
    expect(paths["/api/v1/leaves/{id}/extensions"]?.get).toBeDefined();
    expect(paths["/api/v1/leaves/{id}/extensions"]?.post).toBeDefined();
    expect(paths["/api/v1/extensions/approvals"]?.get).toBeDefined();
    expect(paths["/api/v1/extensions/{id}/approve"]?.post).toBeDefined();

    // 5. Approvals Queue
    expect(paths["/api/v1/approvals"]?.get).toBeDefined();

    // 6. Movement & Gate Control
    expect(paths["/api/v1/movements/generate-qr"]?.post).toBeDefined();
    expect(paths["/api/v1/movements/scan/preview"]?.post).toBeDefined();
    expect(paths["/api/v1/movements/scan"]?.post).toBeDefined();
    expect(paths["/api/v1/movements"]?.get).toBeDefined();
    expect(paths["/api/v1/overdue"]?.get).toBeDefined();
    expect(paths["/api/v1/overdue/count"]?.get).toBeDefined();

    // 7. Parent Portal & Management
    expect(paths["/api/parent-approve/{token}/decision"]?.post).toBeDefined();
    expect(paths["/api/v1/parents"]?.get).toBeDefined();
    expect(paths["/api/v1/parents"]?.post).toBeDefined();

    // 8. Dashboard & Analytics
    expect(paths["/api/v1/dashboard/stats"]?.get).toBeDefined();
    expect(paths["/api/v1/badges"]?.get).toBeDefined();
    expect(paths["/api/v1/analytics/leaves"]?.get).toBeDefined();
    expect(paths["/api/v1/analytics/movements"]?.get).toBeDefined();

    // 9. Hostel & Academic Structure
    expect(paths["/api/v1/hostels"]?.get).toBeDefined();
    expect(paths["/api/v1/departments"]?.get).toBeDefined();
    expect(paths["/api/v1/academic-groups"]?.get).toBeDefined();

    // 10. Administration & System
    expect(paths["/api/v1/leave-types"]?.get).toBeDefined();
    expect(paths["/api/v1/admin/leave-types"]?.get).toBeDefined();
    expect(paths["/api/v1/policies"]?.get).toBeDefined();
    expect(paths["/api/v1/audit"]?.get).toBeDefined();
    expect(paths["/api/health"]?.get).toBeDefined();
  });

  it("documents approvalContactId and security behavior on POST /api/v1/leaves", () => {
    const doc = getOpenApiDocument();
    const createLeavePost = doc.paths?.["/api/v1/leaves"]?.post;

    expect(createLeavePost).toBeDefined();

    const schemaRef =
      createLeavePost?.requestBody?.content?.["application/json"]?.schema;
    expect(schemaRef).toBeDefined();

    const schemas = doc.components?.schemas ?? {};
    const createLeaveSchema = schemas["CreateLeaveRequest"] as any;

    expect(createLeaveSchema).toBeDefined();
    expect(createLeaveSchema.properties).toHaveProperty("approvalContactId");
    expect(createLeaveSchema.properties.approvalContactId.description).toContain(
      "Contact ID belonging to the authenticated student"
    );

    expect(createLeavePost?.responses?.["400"]?.description).toContain(
      "approvalContactId"
    );
    expect(createLeavePost?.responses?.["403"]?.description).toContain(
      "contact does not belong"
    );
    expect(createLeavePost?.responses?.["409"]?.description).toContain(
      "Overlapping"
    );
  });

  it("serves OpenAPI JSON at /api/v1/openapi.json", async () => {
    const res = await getOpenApiJsonHandler();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.openapi).toBe("3.1.0");
    expect(json.info.title).toContain("SST Hostel Leave");
    expect(json.paths["/api/v1/leaves"]).toBeDefined();
    expect(json.paths["/api/v1/approvals"]).toBeDefined();
    expect(json.paths["/api/health"]).toBeDefined();
  });

  it("renders Scalar UI at /api/docs", async () => {
    const req = new Request("http://localhost:3000/api/docs");
    const res = await getDocsHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("openapi.json");
    expect(html).toContain("scalar");
  });
});
