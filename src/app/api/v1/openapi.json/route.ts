import { NextResponse } from "next/server";

import { getOpenApiDocument } from "@/lib/openapi/spec";

export const dynamic = "force-static";

export function GET() {
  const spec = getOpenApiDocument();
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
