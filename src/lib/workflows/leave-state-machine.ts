import { LEAVE_REQUEST_STATUS, type LeaveRequestStatus } from "@/constants/leave/leave-status";
import { ConflictError } from "@/lib/errors";

export const LEAVE_ACTION = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  CANCEL: "CANCEL",
  COMPLETE: "COMPLETE",
  EXPIRE: "EXPIRE",
  EXTEND: "EXTEND",
} as const;

export type LeaveAction = typeof LEAVE_ACTION[keyof typeof LEAVE_ACTION];

export const LEAVE_TRANSITIONS: Record<string, string[]> = {
  PENDING: [
    "APPROVE",
    "REJECT",
    "CANCEL",
  ],

  APPROVED: [
    "COMPLETE",
    "EXPIRE",
    "EXTEND",
    "CANCEL",
  ],

  REJECTED: [],

  CANCELLED: [],

  COMPLETED: [],

  EXPIRED: [],
};

export function canTransition(
  currentStatus: string,
  action: LeaveAction
): boolean {
  return LEAVE_TRANSITIONS[currentStatus]?.includes(action) ?? false;
}

export function getNextState(
  currentStatus: string,
  action: LeaveAction
): LeaveRequestStatus {
  if (!canTransition(currentStatus, action)) {
    throw new ConflictError(`Invalid state transition: Cannot perform ${action} from ${currentStatus}`);
  }

  const transitionMap: Record<string, Partial<Record<LeaveAction, LeaveRequestStatus>>> = {
    PENDING: {
      APPROVE: LEAVE_REQUEST_STATUS.APPROVED,
      REJECT: LEAVE_REQUEST_STATUS.REJECTED,
      CANCEL: LEAVE_REQUEST_STATUS.CANCELLED,
    },
    APPROVED: {
      COMPLETE: LEAVE_REQUEST_STATUS.COMPLETED,
      EXPIRE: LEAVE_REQUEST_STATUS.EXPIRED,
      CANCEL: LEAVE_REQUEST_STATUS.CANCELLED,
      EXTEND: LEAVE_REQUEST_STATUS.APPROVED,
    }
  };

  const nextStatus = transitionMap[currentStatus]?.[action];
  
  if (!nextStatus) {
    throw new ConflictError(`State mapping missing for ${currentStatus} + ${action}`);
  }

  return nextStatus;
}
