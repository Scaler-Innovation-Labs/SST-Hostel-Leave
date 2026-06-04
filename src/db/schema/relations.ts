// =====================================================
// RELATIONS
// src/db/schema/relations.ts
// =====================================================

import { relations } from "drizzle-orm";

import {
  academicGroups,
  departments,
  students,
} from "./academics";
import {
  auditLogs,
} from "./audit";
import {
  roles,
  userRoles,
  users,
} from "./auth";
import {
  hostels,
  parents,
} from "./hostel";
import {
  leaveApprovals,
  leaveDocuments,
  leaveExtensions,
  leaveRequests,
  leaveTypeApprovalSteps,
  leaveTypes,
  operationalPeriods,
} from "./leave";
import {
  movementEvents,
  movementStates,
  qrPasses,
  qrScanLogs,
} from "./movement";
import {
  inboundSmsLogs,
  notificationLogs,
  sheetSyncLogs,
} from "./notification";
import {
  policies,
} from "./policy";

// =====================================================
// AUTH RELATIONS
// =====================================================

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),

  leaveApprovals: many(leaveApprovals),

  uploadedDocuments: many(leaveDocuments),

  qrScanLogs: many(qrScanLogs),

  movementEvents: many(movementEvents),

  notificationLogs: many(notificationLogs),

  auditLogs: many(auditLogs),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),

  approvalSteps: many(leaveTypeApprovalSteps),

  leaveApprovals: many(leaveApprovals),
}));

export const userRolesRelations = relations(
  userRoles,
  ({ one }) => ({
    user: one(users, {
      fields: [userRoles.userId],
      references: [users.id],
    }),

    role: one(roles, {
      fields: [userRoles.roleId],
      references: [roles.id],
    }),
  })
);

// =====================================================
// ACADEMICS RELATIONS
// =====================================================

export const departmentsRelations = relations(
  departments,
  ({ many }) => ({
    academicGroups: many(academicGroups),
  })
);

export const academicGroupsRelations = relations(
  academicGroups,
  ({ one, many }) => ({
    department: one(departments, {
      fields: [academicGroups.departmentId],
      references: [departments.id],
    }),

    students: many(students),
  })
);

export const studentsRelations = relations(
  students,
  ({ one, many }) => ({
    user: one(users, {
      fields: [students.userId],
      references: [users.id],
    }),

    academicGroup: one(academicGroups, {
      fields: [students.academicGroupId],
      references: [academicGroups.id],
    }),

    movementState: one(movementStates, {
      fields: [students.currentLocationState],
      references: [movementStates.code],
    }),

    parents: many(parents),

    leaveRequests: many(leaveRequests),

    qrPasses: many(qrPasses),

    movementEvents: many(movementEvents),
  })
);

// =====================================================
// HOSTEL RELATIONS
// =====================================================

export const hostelsRelations = relations(
  hostels,
  ({ many }) => ({
    operationalPeriods: many(operationalPeriods),

    policies: many(policies),
  })
);

export const parentsRelations = relations(
  parents,
  ({ one, many }) => ({
    student: one(students, {
      fields: [parents.studentId],
      references: [students.id],
    }),

    leaveApprovals: many(leaveApprovals),

    inboundSmsLogs: many(inboundSmsLogs),

    notificationLogs: many(notificationLogs),
  })
);

// =====================================================
// LEAVE RELATIONS
// =====================================================

export const leaveTypesRelations = relations(
  leaveTypes,
  ({ many }) => ({
    approvalSteps: many(leaveTypeApprovalSteps),

    leaveRequests: many(leaveRequests),

    policies: many(policies),
  })
);

export const leaveTypeApprovalStepsRelations =
  relations(
    leaveTypeApprovalSteps,
    ({ one }) => ({
      leaveType: one(leaveTypes, {
        fields: [leaveTypeApprovalSteps.leaveTypeId],
        references: [leaveTypes.id],
      }),

      approverRole: one(roles, {
        fields: [leaveTypeApprovalSteps.approverRoleId],
        references: [roles.id],
      }),
    })
  );

export const leaveRequestsRelations = relations(
  leaveRequests,
  ({ one, many }) => ({
    student: one(students, {
      fields: [leaveRequests.studentId],
      references: [students.id],
    }),

    leaveType: one(leaveTypes, {
      fields: [leaveRequests.leaveTypeId],
      references: [leaveTypes.id],
    }),

    leaveExtensions: many(leaveExtensions),

    leaveApprovals: many(leaveApprovals),

    leaveDocuments: many(leaveDocuments),

    qrPasses: many(qrPasses),

    movementEvents: many(movementEvents),

    notificationLogs: many(notificationLogs),

    inboundSmsLogs: many(inboundSmsLogs),

    sheetSyncLogs: many(sheetSyncLogs),
  })
);

export const leaveExtensionsRelations = relations(
  leaveExtensions,
  ({ one, many }) => ({
    leaveRequest: one(leaveRequests, {
      fields: [leaveExtensions.leaveRequestId],
      references: [leaveRequests.id],
    }),

    leaveApprovals: many(leaveApprovals),

    leaveDocuments: many(leaveDocuments),

    notificationLogs: many(notificationLogs),

    inboundSmsLogs: many(inboundSmsLogs),

    sheetSyncLogs: many(sheetSyncLogs),
  })
);

export const leaveApprovalsRelations = relations(
  leaveApprovals,
  ({ one }) => ({
    leaveRequest: one(leaveRequests, {
      fields: [leaveApprovals.leaveRequestId],
      references: [leaveRequests.id],
    }),

    leaveExtension: one(leaveExtensions, {
      fields: [leaveApprovals.leaveExtensionId],
      references: [leaveExtensions.id],
    }),

    approverRole: one(roles, {
      fields: [leaveApprovals.approverRoleId],
      references: [roles.id],
    }),

    approverUser: one(users, {
      fields: [leaveApprovals.approverUserId],
      references: [users.id],
    }),

    approverParent: one(parents, {
      fields: [leaveApprovals.approverParentId],
      references: [parents.id],
    }),
  })
);

export const leaveDocumentsRelations = relations(
  leaveDocuments,
  ({ one }) => ({
    leaveRequest: one(leaveRequests, {
      fields: [leaveDocuments.leaveRequestId],
      references: [leaveRequests.id],
    }),

    leaveExtension: one(leaveExtensions, {
      fields: [leaveDocuments.leaveExtensionId],
      references: [leaveExtensions.id],
    }),

    uploadedBy: one(users, {
      fields: [leaveDocuments.uploadedBy],
      references: [users.id],
    }),
  })
);

export const operationalPeriodsRelations =
  relations(
    operationalPeriods,
    ({ one }) => ({
      hostel: one(hostels, {
        fields: [operationalPeriods.hostelId],
        references: [hostels.id],
      }),
    })
  );

// =====================================================
// MOVEMENT RELATIONS
// =====================================================

export const movementStatesRelations = relations(
  movementStates,
  ({ many }) => ({
    students: many(students),

    fromMovementEvents: many(movementEvents, {
      relationName: "fromStateRelation",
    }),

    toMovementEvents: many(movementEvents, {
      relationName: "toStateRelation",
    }),
  })
);

export const qrPassesRelations = relations(
  qrPasses,
  ({ one, many }) => ({
    leaveRequest: one(leaveRequests, {
      fields: [qrPasses.leaveRequestId],
      references: [leaveRequests.id],
    }),

    student: one(students, {
      fields: [qrPasses.studentId],
      references: [students.id],
    }),

    qrScanLogs: many(qrScanLogs),

    movementEvents: many(movementEvents),
  })
);

export const qrScanLogsRelations = relations(
  qrScanLogs,
  ({ one }) => ({
    qrPass: one(qrPasses, {
      fields: [qrScanLogs.qrPassId],
      references: [qrPasses.id],
    }),

    scannedBy: one(users, {
      fields: [qrScanLogs.scannedBy],
      references: [users.id],
    }),
  })
);

export const movementEventsRelations = relations(
  movementEvents,
  ({ one }) => ({
    student: one(students, {
      fields: [movementEvents.studentId],
      references: [students.id],
    }),

    leaveRequest: one(leaveRequests, {
      fields: [movementEvents.leaveRequestId],
      references: [leaveRequests.id],
    }),

    qrPass: one(qrPasses, {
      fields: [movementEvents.qrPassId],
      references: [qrPasses.id],
    }),

    recordedBy: one(users, {
      fields: [movementEvents.recordedBy],
      references: [users.id],
    }),

    fromState: one(movementStates, {
      relationName: "fromStateRelation",

      fields: [movementEvents.fromState],
      references: [movementStates.code],
    }),

    toState: one(movementStates, {
      relationName: "toStateRelation",

      fields: [movementEvents.toState],
      references: [movementStates.code],
    }),
  })
);

// =====================================================
// POLICY RELATIONS
// =====================================================

export const policiesRelations = relations(
  policies,
  ({ one }) => ({
    leaveType: one(leaveTypes, {
      fields: [policies.leaveTypeId],
      references: [leaveTypes.id],
    }),

    hostel: one(hostels, {
      fields: [policies.hostelId],
      references: [hostels.id],
    }),
  })
);

// =====================================================
// NOTIFICATION RELATIONS
// =====================================================

export const notificationLogsRelations =
  relations(
    notificationLogs,
    ({ one }) => ({
      leaveRequest: one(leaveRequests, {
        fields: [notificationLogs.leaveRequestId],
        references: [leaveRequests.id],
      }),

      leaveExtension: one(leaveExtensions, {
        fields: [notificationLogs.leaveExtensionId],
        references: [leaveExtensions.id],
      }),

      user: one(users, {
        fields: [notificationLogs.userId],
        references: [users.id],
      }),

      parent: one(parents, {
        fields: [notificationLogs.parentId],
        references: [parents.id],
      }),
    })
  );

export const inboundSmsLogsRelations =
  relations(
    inboundSmsLogs,
    ({ one }) => ({
      parent: one(parents, {
        fields: [inboundSmsLogs.parentId],
        references: [parents.id],
      }),

      leaveRequest: one(leaveRequests, {
        fields: [inboundSmsLogs.leaveRequestId],
        references: [leaveRequests.id],
      }),

      leaveExtension: one(leaveExtensions, {
        fields: [inboundSmsLogs.leaveExtensionId],
        references: [leaveExtensions.id],
      }),
    })
  );

export const sheetSyncLogsRelations = relations(
  sheetSyncLogs,
  ({ one }) => ({
    leaveRequest: one(leaveRequests, {
      fields: [sheetSyncLogs.leaveRequestId],
      references: [leaveRequests.id],
    }),

    leaveExtension: one(leaveExtensions, {
      fields: [sheetSyncLogs.leaveExtensionId],
      references: [leaveExtensions.id],
    }),
  })
);

// =====================================================
// AUDIT RELATIONS
// =====================================================

export const auditLogsRelations = relations(
  auditLogs,
  ({ one }) => ({
    actorUser: one(users, {
      fields: [auditLogs.actorUserId],
      references: [users.id],
    }),
  })
);
