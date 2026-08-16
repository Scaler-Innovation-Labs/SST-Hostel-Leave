import type { MovementState } from "@/constants/movement";
import { MOVEMENT_STATE } from "@/constants/movement";
import { ConflictError } from "@/lib/errors";

export const MOVEMENT_ACTION = {
	EXIT_HOSTEL: "EXIT_HOSTEL",
	ENTER_HOSTEL: "ENTER_HOSTEL",
	MARK_OVERDUE: "MARK_OVERDUE",
	MANUAL_RETURN: "MANUAL_RETURN",
	MANUAL_CHECKOUT: "MANUAL_CHECKOUT",
	SECURITY_OVERRIDE: "SECURITY_OVERRIDE",
	INVALIDATE_QR: "INVALIDATE_QR",
} as const;

export type MovementAction =
	(typeof MOVEMENT_ACTION)[keyof typeof MOVEMENT_ACTION];

export const MOVEMENT_TRANSITIONS: Record<
	MovementState,
	MovementAction[]
> = {
	// Contract T2/T4: a student may exit directly from IN_HOSTEL — approval
	// never mutates location, so there is no intermediate APPROVED_LEAVE step.
	IN_HOSTEL: [
		MOVEMENT_ACTION.EXIT_HOSTEL,
		MOVEMENT_ACTION.MANUAL_CHECKOUT,
	],

	// LEGACY BRIDGE ONLY: APPROVED_LEAVE predates the contract (approval used
	// to record IN_HOSTEL → APPROVED_LEAVE). Rows created before the temporal
	// fix may still hold it; keep their exit/return/invalidate paths working
	// until the Phase-6 migration reconciles them. Nothing new may enter this
	// state.
	APPROVED_LEAVE: [
		MOVEMENT_ACTION.EXIT_HOSTEL,
		MOVEMENT_ACTION.ENTER_HOSTEL,
		MOVEMENT_ACTION.INVALIDATE_QR,
		MOVEMENT_ACTION.MANUAL_CHECKOUT,
	],

	CHECKED_OUT: [
		MOVEMENT_ACTION.ENTER_HOSTEL,
		MOVEMENT_ACTION.MARK_OVERDUE,
		MOVEMENT_ACTION.MANUAL_RETURN,
	],

	OUTSIDE_HOSTEL: [
		MOVEMENT_ACTION.ENTER_HOSTEL,
		MOVEMENT_ACTION.MARK_OVERDUE,
		MOVEMENT_ACTION.MANUAL_RETURN,
	],

	// Contract T8: an overdue student may still check back in by scanning the
	// open session's return QR (ENTER_HOSTEL) or via manual return/override.
	OVERDUE: [
		MOVEMENT_ACTION.ENTER_HOSTEL,
		MOVEMENT_ACTION.MANUAL_RETURN,
		MOVEMENT_ACTION.SECURITY_OVERRIDE,
	],
};

export const MOVEMENT_TRANSITION_MAP: Record<
	string,
	Partial<Record<MovementAction, MovementState>>
> = {
	IN_HOSTEL: {
		EXIT_HOSTEL: MOVEMENT_STATE.OUTSIDE_HOSTEL,
		MANUAL_CHECKOUT: MOVEMENT_STATE.CHECKED_OUT,
	},
	APPROVED_LEAVE: {
		EXIT_HOSTEL: MOVEMENT_STATE.OUTSIDE_HOSTEL,
		ENTER_HOSTEL: MOVEMENT_STATE.IN_HOSTEL,
		INVALIDATE_QR: MOVEMENT_STATE.IN_HOSTEL,
		MANUAL_CHECKOUT: MOVEMENT_STATE.CHECKED_OUT,
	},
	CHECKED_OUT: {
		ENTER_HOSTEL: MOVEMENT_STATE.IN_HOSTEL,
		MARK_OVERDUE: MOVEMENT_STATE.OVERDUE,
		MANUAL_RETURN: MOVEMENT_STATE.IN_HOSTEL,
	},
	OUTSIDE_HOSTEL: {
		ENTER_HOSTEL: MOVEMENT_STATE.IN_HOSTEL,
		MARK_OVERDUE: MOVEMENT_STATE.OVERDUE,
		MANUAL_RETURN: MOVEMENT_STATE.IN_HOSTEL,
	},
	OVERDUE: {
		ENTER_HOSTEL: MOVEMENT_STATE.IN_HOSTEL,
		MANUAL_RETURN: MOVEMENT_STATE.IN_HOSTEL,
		SECURITY_OVERRIDE: MOVEMENT_STATE.IN_HOSTEL,
	},
};

export function canTransition(
	currentState: MovementState,
	action: MovementAction
): boolean {
	return (
		MOVEMENT_TRANSITIONS[currentState]?.includes(action) ??
		false
	);
}

export function getNextState(
	currentState: MovementState,
	action: MovementAction
): MovementState {
	if (!canTransition(currentState, action)) {
		throw new ConflictError(
			`Invalid movement transition: Cannot perform ${action} from ${currentState}`
		);
	}

	const next =
		MOVEMENT_TRANSITION_MAP[currentState]?.[action];

	if (!next) {
		throw new ConflictError(
			`Movement state mapping missing for ${currentState} + ${action}`
		);
	}

	return next;
}
