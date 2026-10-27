import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";

import { registry } from "./registry";
import { registerAdminRoutes } from "./routes/admin";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerApprovalRoutes } from "./routes/approvals";
import { registerAuthRoutes } from "./routes/auth";
import { registerExtensionRoutes } from "./routes/extensions";
import { registerLeaveRoutes } from "./routes/leaves";
import { registerMovementRoutes } from "./routes/movements";
import { registerParentRoutes } from "./routes/parents";
import { registerStructureRoutes } from "./routes/structure";
import { registerStudentRoutes } from "./routes/students";

let registered = false;

function ensureRoutesRegistered() {
  if (registered) return;
  registerAuthRoutes();
  registerStudentRoutes();
  registerLeaveRoutes();
  registerExtensionRoutes();
  registerApprovalRoutes();
  registerMovementRoutes();
  registerParentRoutes();
  registerAnalyticsRoutes();
  registerStructureRoutes();
  registerAdminRoutes();
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
        name: "Auth & Identity",
        description: "Session identity, active role switching, and role permissions",
      },
      {
        name: "Students & Contacts",
        description: "Student directory, emergency contact routing, room mappings, and bulk imports",
      },
      {
        name: "Leaves",
        description: "Student leave request creation, listing, cancellation, staff approval chain, documents, and questions",
      },
      {
        name: "Leave Extensions",
        description: "Leave extension requests, history, and approval workflows",
      },
      {
        name: "Approvals Queue",
        description: "Centralized approval queue with step, role, and hostel scoping",
      },
      {
        name: "Movement & Gate Control",
        description: "Time-windowed gate passes (20s rotating QR codes), guard preview, check-in/out scans, manual overrides, and overdue tracking",
      },
      {
        name: "Parent Portal",
        description: "Token-authenticated passwordless parent approvals and guardian management",
      },
      {
        name: "Dashboard & Analytics",
        description: "Dashboard KPIs, navigation badge counts, and leave/movement trend metrics",
      },
      {
        name: "Hostel & Academic Structure",
        description: "Campus blocks, academic departments, and student cohort configuration",
      },
      {
        name: "Administration & System",
        description: "Leave category definitions, policy engine rules, emergency overrides, audit trails, and health probes",
      },
    ],
  });
}
