import { describe, it, expect } from "vitest";
import { ApiResponse } from "@/lib/api/response";

describe("ApiResponse helper", () => {
  it("returns standard success payload", async () => {
    const res = ApiResponse.success({ message: "ok" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      data: { message: "ok" },
    });
  });

  it("returns created response with 201 status", async () => {
    const res = ApiResponse.created({ id: "123" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: "123" });
  });

  it("returns cached response with private Cache-Control headers", async () => {
    const res = ApiResponse.cached({ items: [1, 2, 3] }, 300, 600);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300, stale-while-revalidate=600");
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ items: [1, 2, 3] });
  });

  it("attaches custom headers to success response", async () => {
    const res = ApiResponse.success({ ok: true }, 200, {
      "X-Custom-Header": "test-val",
    });
    expect(res.headers.get("X-Custom-Header")).toBe("test-val");
  });
});
