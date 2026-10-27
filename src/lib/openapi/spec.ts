import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";

import { registry } from "./registry";
import { registerLeaveRoutes } from "./routes/leaves";
import { registerMovementRoutes } from "./routes/movements";
import { registerParentRoutes } from "./routes/parents";

let registered = false;

function ensureRoutesRegistered() {
  if (registered) return;
  registerLeaveRoutes();
  registerMovementRoutes();
  registerParentRoutes();
  registered = true;
}

export function getOpenApiDocument() {
  ensureRoutesRegistered();

  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "SST Hostel Leave & Movement Management Platform API",
      version: "1.0.0",
      description:
        "Comprehensive API documentation for SST Hostel Leave, Approval Workflows, Gate Passes, QR Scanning, and Parent Verification.",
      contact: {
        name: "SST Engineering Team",
      },
    },
    servers: [
      {
        url: "/",
        description: "Current environment base URL",
      },
    ],
    tags: [
      {
        name: "Leaves",
        description: "Student leave request creation, listing, cancellation, and staff approval chain",
      },
      {
        name: "Movement & QR",
        description: "Time-windowed gate passes (20s rotating QR codes), guard preview, and gate exit/return scans",
      },
      {
        name: "Parent Portal",
        description: "Token-authenticated parent approvals and decisions",
      },
    ],
  });
}
