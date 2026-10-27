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
  });

  it("documents all 8 Phase 1 endpoints", () => {
    const doc = getOpenApiDocument();
    const paths = doc.paths ?? {};

    // 1. Leave creation & listing
    expect(paths["/api/v1/leaves"]?.post).toBeDefined();
    expect(paths["/api/v1/leaves"]?.get).toBeDefined();

    // 2. Leave actions (approve, cancel)
    expect(paths["/api/v1/leaves/{id}/approve"]?.post).toBeDefined();
    expect(paths["/api/v1/leaves/{id}/cancel"]?.post).toBeDefined();

    // 3. Movement & QR (generate-qr, preview, commit)
    expect(paths["/api/v1/movements/generate-qr"]?.post).toBeDefined();
    expect(paths["/api/v1/movements/scan/preview"]?.post).toBeDefined();
    expect(paths["/api/v1/movements/scan"]?.post).toBeDefined();

    // 4. Parent decision
    expect(paths["/api/parent-approve/{token}/decision"]?.post).toBeDefined();
  });

  it("documents approvalContactId and security behavior on POST /api/v1/leaves", () => {
    const doc = getOpenApiDocument();
    const createLeavePost = doc.paths?.["/api/v1/leaves"]?.post;

    expect(createLeavePost).toBeDefined();

    // Check request schema
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

    // Check responses (400 validation error mentions approvalContactId security check)
    expect(createLeavePost?.responses?.["400"]?.description).toContain(
      "approvalContactId"
    );
    expect(createLeavePost?.responses?.["403"]?.description).toContain(
      "Only students"
    );
    expect(createLeavePost?.responses?.["409"]?.description).toContain(
      "Conflict"
    );
  });

  it("serves OpenAPI JSON at /api/v1/openapi.json", async () => {
    const res = await getOpenApiJsonHandler();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.openapi).toBe("3.1.0");
    expect(json.info.title).toContain("SST Hostel Leave");
    expect(json.paths["/api/v1/leaves"]).toBeDefined();
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
