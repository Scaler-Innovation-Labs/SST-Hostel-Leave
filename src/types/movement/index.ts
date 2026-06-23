import type { MovementState } from "@/constants/movement";

export type MovementTransition = {
	fromState: MovementState;
	toState: MovementState;
	eventType: string;
	method: string;
}

export type MovementEventInput = {
	studentId: string;
	leaveRequestId?: string;
	qrPassId?: string;
	eventType: string;
	fromState: MovementState;
	toState: MovementState;
	movementMethod: string;
	isManualOverride?: boolean;
	overrideReason?: string;
	recordedBy?: string;
	occurredAt?: Date;
	metadata?: Record<string, unknown>;
}

export type QrScanInput = {
	qrPassId: string;
	scannedBy: string;
	scanType: "EXIT_SCAN" | "RETURN_SCAN";
	scanResult: "SUCCESS" | "FAILED";
	failureReason?: string;
	metadata?: Record<string, unknown>;
}

export type StudentLocationUpdate = {
	studentId: string;
	newLocation: MovementState;
}
