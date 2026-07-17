import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import type { MovementState } from "@/constants/movement";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { qrScanLogRepository } from "@/db/repositories/movement/qr-scan-log.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { transaction } from "@/lib/db/transaction";
import { ConflictError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

import { recordMovement } from "./record-movement.service";

async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
	return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type ScanQrInput = {
	token: string;
	scannedBy: string;
	scanType?: "EXIT_SCAN" | "RETURN_SCAN";
}

export type ScanResult = {
	scanLogId: string;
	success: boolean;
	scanType?: "EXIT_SCAN" | "RETURN_SCAN";
	movementEventId?: string;
	failureReason?: string;
}

export async function scanQrPass(
	input: ScanQrInput
): Promise<ScanResult> {
	const tokenHash = await hashToken(input.token);

	const pass =
		await qrPassRepository.findByTokenHash(tokenHash);

	if (!pass) {
		const log = await qrScanLogRepository.create({
			qrPassId: null,
			scannedBy: input.scannedBy,
			scanType: input.scanType ?? "EXIT_SCAN",
			scanResult: "FAILED",
			failureReason: "QR token not found",
		});

		return {
			scanLogId: log.id,
			success: false,
			scanType: input.scanType ?? "EXIT_SCAN",
			failureReason: "QR token not found",
		};
	}

	if (pass.status !== QR_STATUS.ACTIVE) {
		const log = await qrScanLogRepository.create({
			qrPassId: pass.id,
			scannedBy: input.scannedBy,
			scanType: input.scanType ?? "EXIT_SCAN",
			scanResult: "FAILED",
			failureReason: `QR pass status is ${pass.status}`,
		});

		return {
			scanLogId: log.id,
			success: false,
			scanType: input.scanType ?? "EXIT_SCAN",
			failureReason: `QR pass status is ${pass.status}`,
		};
	}

	if (pass.expiresAt && new Date() > pass.expiresAt) {
		await qrPassRepository.invalidate(pass.id);

		const log = await qrScanLogRepository.create({
			qrPassId: pass.id,
			scannedBy: input.scannedBy,
			scanType: input.scanType ?? "EXIT_SCAN",
			scanResult: "FAILED",
			failureReason: "QR pass has expired",
		});

		return {
			scanLogId: log.id,
			success: false,
			scanType: input.scanType ?? "EXIT_SCAN",
			failureReason: "QR pass has expired",
		};
	}

	// Auto-detect scan type from QR pass state if not provided
	if (!input.scanType) {
		if (pass.qrType === "LEAVE_RETURN") {
			input = { ...input, scanType: "RETURN_SCAN" };
		} else if (!pass.firstScanAt) {
			input = { ...input, scanType: "EXIT_SCAN" };
		} else if (!pass.closedAt) {
			input = { ...input, scanType: "RETURN_SCAN" };
		} else {
			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "RETURN_SCAN",
				scanResult: "FAILED",
				failureReason: "QR pass has already been fully used",
			});

			return {
				scanLogId: log.id,
				success: false,
				failureReason: "QR pass has already been fully used",
			};
		}
	}

	if (input.scanType === "EXIT_SCAN" && pass.firstScanAt) {
		const log = await qrScanLogRepository.create({
			qrPassId: pass.id,
			scannedBy: input.scannedBy,
			scanType: input.scanType,
			scanResult: "FAILED",
			failureReason: "QR pass has already been used for exit",
		});

		return {
			scanLogId: log.id,
			success: false,
			scanType: "EXIT_SCAN",
			failureReason: "QR pass has already been used for exit",
		};
	}

	if (input.scanType === "RETURN_SCAN" && pass.closedAt) {
		const log = await qrScanLogRepository.create({
			qrPassId: pass.id,
			scannedBy: input.scannedBy,
			scanType: input.scanType,
			scanResult: "FAILED",
			failureReason: "QR pass has already been used for return",
		});

		return {
			scanLogId: log.id,
			success: false,
			scanType: "RETURN_SCAN",
			failureReason: "QR pass has already been used for return",
		};
	}

	if (input.scanType === "RETURN_SCAN" && !pass.firstScanAt && pass.qrType !== "LEAVE_RETURN") {
		const log = await qrScanLogRepository.create({
			qrPassId: pass.id,
			scannedBy: input.scannedBy,
			scanType: input.scanType,
			scanResult: "FAILED",
			failureReason: "Student has not exited yet",
		});

		return {
			scanLogId: log.id,
			success: false,
			scanType: "RETURN_SCAN",
			failureReason: "Student has not exited yet",
		};
	}

	if (input.scanType === "EXIT_SCAN") {
		return await transaction(async (tx) => {
			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "EXIT_SCAN",
				scanResult: "SUCCESS",
			}, tx);

			await qrPassRepository.markAsFirstScanned(pass.id, tx);

			const movementEvent = await recordMovement({
				studentId: pass.studentId,
				leaveRequestId: pass.leaveRequestId,
				qrPassId: pass.id,
				fromState: MOVEMENT_STATE.APPROVED_LEAVE,
				toState: MOVEMENT_STATE.OUTSIDE_HOSTEL,
				eventType: "EXIT_HOSTEL",
				movementMethod: "QR",
				recordedBy: input.scannedBy,
				dbClient: tx,
			});

			await auditService.record(
				AUDIT_ACTION.CREATE,
				AUDIT_ENTITY_TYPE.QR_PASS,
				pass.id,
				input.scannedBy,
				{
					scanType: "EXIT_SCAN",
					scanResult: "SUCCESS",
					qrPassId: pass.id,
				},
				tx
			);

			await outboxService.publish({
				eventType: OUTBOX_EVENT_TYPE.QR_SCANNED,
				aggregateType: AGGREGATE_TYPE.QR_PASS,
				aggregateId: pass.id,
				payload: {
					qrPassId: pass.id,
					leaveRequestId: pass.leaveRequestId,
					studentId: pass.studentId,
					scanType: "EXIT_SCAN",
					scanResult: "SUCCESS",
				},
			}, tx);

			return {
				scanLogId: log.id,
				success: true,
				scanType: "EXIT_SCAN",
				movementEventId: movementEvent.id,
			};
		});
	}

	if (input.scanType === "RETURN_SCAN") {
		return await transaction(async (tx) => {
			const student = await studentRepository.findById(pass.studentId, tx);

			if (!student) {
				throw new ConflictError("Student not found for QR pass");
			}

			const fromState = student.currentLocationState as MovementState;

			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "RETURN_SCAN",
				scanResult: "SUCCESS",
			}, tx);

			await qrPassRepository.markAsClosed(pass.id, tx);

			const movementEvent = await recordMovement({
				studentId: pass.studentId,
				leaveRequestId: pass.leaveRequestId,
				qrPassId: pass.id,
				fromState,
				toState: MOVEMENT_STATE.IN_HOSTEL,
				eventType: "ENTER_HOSTEL",
				movementMethod: "QR",
				recordedBy: input.scannedBy,
				dbClient: tx,
			});

			const completedAt = new Date();

			await leaveRepository.updateById(
				pass.leaveRequestId,
				{
					status: LEAVE_REQUEST_STATUS.COMPLETED,
					completedAt,
					actualReturnAt: completedAt,
					currentStepKey: null,
					currentStepOrder: null,
				},
				tx
			);

			await auditService.record(
				AUDIT_ACTION.UPDATE,
				AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
				pass.leaveRequestId,
				input.scannedBy,
				{
					oldStatus: LEAVE_REQUEST_STATUS.APPROVED,
					newStatus: LEAVE_REQUEST_STATUS.COMPLETED,
					completedAt: completedAt.toISOString(),
				},
				tx
			);

			await auditService.record(
				AUDIT_ACTION.CREATE,
				AUDIT_ENTITY_TYPE.QR_PASS,
				pass.id,
				input.scannedBy,
				{
					scanType: "RETURN_SCAN",
					scanResult: "SUCCESS",
					qrPassId: pass.id,
				},
				tx
			);

			await outboxService.publish({
				eventType: OUTBOX_EVENT_TYPE.LEAVE_COMPLETED,
				aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
				aggregateId: pass.leaveRequestId,
				payload: {
					leaveId: pass.leaveRequestId,
					studentId: pass.studentId,
					completedAt: completedAt.toISOString(),
				},
			}, tx);

			await outboxService.publish({
				eventType: OUTBOX_EVENT_TYPE.QR_SCANNED,
				aggregateType: AGGREGATE_TYPE.QR_PASS,
				aggregateId: pass.id,
				payload: {
					qrPassId: pass.id,
					leaveRequestId: pass.leaveRequestId,
					studentId: pass.studentId,
					scanType: "RETURN_SCAN",
					scanResult: "SUCCESS",
				},
			}, tx);

			return {
				scanLogId: log.id,
				success: true,
				scanType: "RETURN_SCAN",
				movementEventId: movementEvent.id,
			};
		});
	}

	const log = await qrScanLogRepository.create({
		qrPassId: pass.id,
		scannedBy: input.scannedBy,
		scanType: input.scanType ?? "EXIT_SCAN",
		scanResult: "SUCCESS",
	});

	return {
		scanLogId: log.id,
		success: true,
		scanType: input.scanType ?? "EXIT_SCAN",
	};
}
