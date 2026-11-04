import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import type { MovementState } from "@/constants/movement";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { getQrExitExpiry, getQrReturnExpiry } from "@/constants/movement/qr-window";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { hostelRepository } from "@/db/repositories/hostel/hostel.repository";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { type QrPass,qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { qrScanLogRepository } from "@/db/repositories/movement/qr-scan-log.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { sha256 } from "@/lib/crypto";
import { endOfDayIst, startOfDayIst } from "@/lib/date-utils";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

import { recordMovement } from "./record-movement.service";

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

/**
 * Auto-detects the scan type a QR pass is ready for:
 * - LEAVE_RETURN passes are always RETURN_SCANs
 * - never-scanned passes are EXIT_SCANs
 * - first-scanned but unclosed passes are RETURN_SCANs
 * - fully used passes (scanned and closed) return null
 *
 * Shared by scanQrPass (commit) and previewQrScan (guard confirmation) so
 * the two can never disagree on the scan type.
 */
export function detectScanType(
	pass: QrPass
): "EXIT_SCAN" | "RETURN_SCAN" | null {
	if (pass.qrType === "LEAVE_RETURN") return "RETURN_SCAN";
	if (!pass.firstScanAt) return "EXIT_SCAN";
	if (!pass.closedAt) return "RETURN_SCAN";
	return null;
}

export function isDailyRecurringLeave(
	leaveType?: { qrMode?: string | null; code?: string | null } | null
): boolean {
	if (!leaveType) return false;
	return (
		leaveType.qrMode === "DAILY_RECURRING" ||
		leaveType.code === "LATE_STAY_COLLEGE"
	);
}

function returnSessionError(
	openSession: QrPass | null,
	pass: QrPass,
	isRecurring = false
): string | null {
	if (openSession && openSession.id !== pass.id) {
		return "Return pass does not match the open movement session";
	}

	if (!openSession && pass.qrType !== "LEAVE_RETURN" && !isRecurring) {
		return "Student has no open movement session";
	}

	return null;
}

export type QrScanPreview = {
	valid: boolean;
	reason?: string;
	scanType?: "EXIT_SCAN" | "RETURN_SCAN";
	student?: {
		name: string;
		rollNumber: string | null;
		roomNumber: string | null;
		hostelName: string | null;
	};
	leave?: {
		typeName: string | null;
		startAt: Date;
		endAt: Date;
		status: string;
	};
}

/**
 * Read-only preview of a QR token for the guard confirmation step. Validates
 * the pass and returns the student/leave identity WITHOUT creating scan logs
 * or mutating any state — only scanQrPass commits a scan. This is the guard's
 * identity-verification step before the physical check-in/exit is recorded.
 */
export async function previewQrScan(token: string): Promise<QrScanPreview> {
	const tokenHash = await sha256(token.trim());
	const pass = await qrPassRepository.findByTokenHash(tokenHash);

	if (!pass) {
		return { valid: false, reason: "QR token not found" };
	}

	if (pass.status !== QR_STATUS.ACTIVE) {
		return { valid: false, reason: `QR pass status is ${pass.status}` };
	}

	const leave = await leaveRepository.findById(pass.leaveRequestId);
	let leaveType = null;
	try {
		leaveType = leave?.leaveTypeId ? await leaveTypeRepository.findById(leave.leaveTypeId) : null;
	} catch {
		leaveType = null;
	}
	const isRecurring = isDailyRecurringLeave(leaveType);

	// For recurring passes (Late Stay at College), both scans are return scans.
	const scanType = isRecurring ? "RETURN_SCAN" : detectScanType(pass);
	if (!scanType) {
		return { valid: false, reason: "QR pass has already been fully used" };
	}

	if (
		leave &&
		leave.status !== LEAVE_REQUEST_STATUS.APPROVED &&
		leave.status !== LEAVE_REQUEST_STATUS.OVERDUE
	) {
		return {
			valid: false,
			reason: `Leave is ${leave.status}`,
		};
	}

	const now = new Date();
	const validFrom = pass.validFrom ?? leave?.startAt;

	// Neither scan may happen before the pass window opens on the departure date.
	if (validFrom && now < startOfDayIst(validFrom)) {
		return {
			valid: false,
			reason: `QR pass is not valid until ${validFrom.toISOString()}`,
		};
	}

	// RETURN is window-gated: usable from leave date through return date (23:59:59.999 IST of endAt).
	const returnExpiry = leave?.endAt
		? getQrReturnExpiry(leave.endAt)
		: (pass.expiresAt ? endOfDayIst(pass.expiresAt) : null);

	// EXIT is window-gated:
	// For recurring passes, exit is usable every day through the end of the return date.
	// For standard passes, usable from departure day till the day before the return date.
	const isExitExpired = isRecurring
		? Boolean(returnExpiry && now > returnExpiry)
		: (pass.expiresAt && now > endOfDayIst(pass.expiresAt)) ||
		  (Boolean(leave?.startAt && leave?.endAt) && now > getQrExitExpiry(leave!.startAt, leave!.endAt));

	if (scanType === "EXIT_SCAN" && isExitExpired) {
		return { valid: false, reason: "QR pass has expired" };
	}

	if (scanType === "RETURN_SCAN" && returnExpiry && now > returnExpiry) {
		return { valid: false, reason: "QR pass has expired" };
	}

	if (isRecurring) {
		const todayScans = await qrScanLogRepository.countTodaySuccessfulScans(
			pass.id,
			startOfDayIst(now),
			endOfDayIst(now)
		);
		if (todayScans.returnCount >= 2 || todayScans.totalCount >= 2) {
			return {
				valid: false,
				reason: "Daily return scan limit reached for today (max 2 return scans per day)",
			};
		}
	}

	if (scanType === "RETURN_SCAN") {
		const openSession = await qrPassRepository.findOpenSessionPassForStudent(
			pass.studentId
		);
		const sessionError = returnSessionError(openSession, pass, isRecurring);

		if (sessionError) {
			return { valid: false, reason: sessionError };
		}
	}

	const student = await studentRepository.findById(pass.studentId);
	const user = student ? await userRepository.findById(student.userId) : null;
	const hostel = user?.hostelId ? await hostelRepository.findById(user.hostelId) : null;

	return {
		valid: true,
		scanType,
		student: {
			name: user?.fullName ?? "Unknown",
			rollNumber: student?.rollNumber ?? null,
			roomNumber: student?.roomNumber ?? null,
			hostelName: hostel?.name ?? null,
		},
		leave: leave ? {
			typeName: leaveType?.name ?? null,
			startAt: leave.startAt,
			endAt: leave.endAt,
			status: leave.status,
		} : undefined,
	};
}

export async function scanQrPass(
	input: ScanQrInput
): Promise<ScanResult> {
	const tokenHash = await sha256(input.token.trim());

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

	// A RETURN_ONLY credential authorizes re-entry, never an exit. Without
	// this guard a caller-supplied EXIT_SCAN could spend the return QR on an
	// exit movement, bypassing the leave type's QR mode.
	if (input.scanType === "EXIT_SCAN" && pass.qrType === "LEAVE_RETURN") {
		const log = await qrScanLogRepository.create({
			qrPassId: pass.id,
			scannedBy: input.scannedBy,
			scanType: "EXIT_SCAN",
			scanResult: "FAILED",
			failureReason: "Return-only QR cannot be used for exit",
		});

		return {
			scanLogId: log.id,
			success: false,
			scanType: "EXIT_SCAN",
			failureReason: "Return-only QR cannot be used for exit",
		};
	}

	const leave = await leaveRepository.findById(pass.leaveRequestId);
	let leaveType = null;
	try {
		leaveType = leave?.leaveTypeId ? await leaveTypeRepository.findById(leave.leaveTypeId) : null;
	} catch {
		leaveType = null;
	}
	const isRecurring = isDailyRecurringLeave(leaveType);

	// For recurring passes (Late Stay at College), every scan is a RETURN_SCAN.
	if (isRecurring) {
		input = { ...input, scanType: "RETURN_SCAN" };
	} else if (!input.scanType) {
		const detected = detectScanType(pass);
		if (!detected) {
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

		input = { ...input, scanType: detected };
	}

	if (isRecurring) {
		const now = new Date();
		const todayScans = await qrScanLogRepository.countTodaySuccessfulScans(
			pass.id,
			startOfDayIst(now),
			endOfDayIst(now)
		);

		// Both scans are return scans: allow up to 2 return scans per day
		if (todayScans.returnCount >= 2 || todayScans.totalCount >= 2) {
			const reason = "Daily return scan limit reached for today (max 2 return scans per day)";
			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "RETURN_SCAN",
				scanResult: "FAILED",
				failureReason: reason,
			});
			return {
				scanLogId: log.id,
				success: false,
				scanType: "RETURN_SCAN",
				failureReason: reason,
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

	if (input.scanType === "RETURN_SCAN" && !pass.firstScanAt && pass.qrType !== "LEAVE_RETURN" && !isRecurring) {
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

	if (input.scanType === "RETURN_SCAN") {
		const validFrom = leave?.startAt ?? pass.validFrom;

		if (validFrom && new Date() < startOfDayIst(validFrom)) {
			const reason = `QR pass is not valid until ${validFrom.toISOString()}`;
			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "RETURN_SCAN",
				scanResult: "FAILED",
				failureReason: reason,
			});

			return {
				scanLogId: log.id,
				success: false,
				scanType: "RETURN_SCAN",
				failureReason: reason,
			};
		}

		const returnExpiry = leave?.endAt
			? getQrReturnExpiry(leave.endAt)
			: (pass.expiresAt ? endOfDayIst(pass.expiresAt) : null);

		if (returnExpiry && new Date() > returnExpiry) {
			await qrPassRepository.invalidate(pass.id);

			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "RETURN_SCAN",
				scanResult: "FAILED",
				failureReason: "QR pass has expired",
			});

			return {
				scanLogId: log.id,
				success: false,
				scanType: "RETURN_SCAN",
				failureReason: "QR pass has expired",
			};
		}

		const openSession =
			await qrPassRepository.findOpenSessionPassForStudent(pass.studentId);
		const sessionError = returnSessionError(openSession, pass, isRecurring);

		if (sessionError) {
			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "RETURN_SCAN",
				scanResult: "FAILED",
				failureReason: sessionError,
			});

			return {
				scanLogId: log.id,
				success: false,
				scanType: "RETURN_SCAN",
				failureReason: sessionError,
			};
		}
	}

	if (input.scanType === "EXIT_SCAN") {
		const validFrom = leave?.startAt ?? pass.validFrom;
		const returnExpiry = leave?.endAt
			? getQrReturnExpiry(leave.endAt)
			: (pass.expiresAt ? endOfDayIst(pass.expiresAt) : null);
		const isExitExpired = isRecurring
			? Boolean(returnExpiry && new Date() > returnExpiry)
			: (pass.expiresAt && new Date() > endOfDayIst(pass.expiresAt)) ||
			  (Boolean(leave?.startAt && leave?.endAt) && new Date() > getQrExitExpiry(leave!.startAt, leave!.endAt));

		// Exit is allowed from the departure day till the day before the return date.
		if (validFrom && new Date() < startOfDayIst(validFrom)) {
			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "EXIT_SCAN",
				scanResult: "FAILED",
				failureReason: `QR pass is not valid until ${validFrom.toISOString()}`,
			});

			return {
				scanLogId: log.id,
				success: false,
				scanType: "EXIT_SCAN",
				failureReason: `QR pass is not valid until ${validFrom.toISOString()}`,
			};
		}

		if (isExitExpired) {
			await qrPassRepository.invalidate(pass.id);

			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "EXIT_SCAN",
				scanResult: "FAILED",
				failureReason: "QR pass has expired",
			});

			return {
				scanLogId: log.id,
				success: false,
				scanType: "EXIT_SCAN",
				failureReason: "QR pass has expired",
			};
		}

		// Contract §7: at most one currently usable-for-exit QR per student.
		// If another in-window ACTIVE pass exists for the same student, the
		// ownership is ambiguous — reject instead of guessing.
		const conflicting =
			await qrPassRepository.findUsableExitPassForStudent(
				pass.studentId,
				pass.id,
				new Date()
			);

		if (conflicting) {
			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "EXIT_SCAN",
				scanResult: "FAILED",
				failureReason: "Another active QR exists for a conflicting leave",
			});

			return {
				scanLogId: log.id,
				success: false,
				scanType: "EXIT_SCAN",
				failureReason: "Another active QR exists for a conflicting leave",
			};
		}

		// Contract T4: EXIT requires NO open movement session. A pass that was
		// first-scanned but never closed means the student is already out (or
		// a stale phantom session exists) — a second exit must not happen.
		// (The usable-conflict check above only sees never-scanned passes, so
		// an open session would slip past it.)
		const openSession =
			await qrPassRepository.findOpenSessionPassForStudent(
				pass.studentId
			);

		if (openSession) {
			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "EXIT_SCAN",
				scanResult: "FAILED",
				failureReason: "Student already has an open movement session",
			});

			return {
				scanLogId: log.id,
				success: false,
				scanType: "EXIT_SCAN",
				failureReason: "Student already has an open movement session",
			};
		}

		let auditQrPassId: string | null = pass.id;
		try {
			return await transaction(async (tx) => {
				// Re-validate the pass inside the transaction — the snapshot read
				// above may be stale (a concurrent invalidate/cancel can win the
				// race between the two reads).
				const passInTx = await qrPassRepository.findById(pass.id, tx);
				if (passInTx) auditQrPassId = passInTx.id;

			if (!passInTx || passInTx.status !== QR_STATUS.ACTIVE) {
				throw new ConflictError("QR pass is no longer active");
			}

			if (passInTx.tokenHash !== pass.tokenHash) {
				throw new ConflictError("QR pass token has been rotated");
			}

			if (passInTx.closedAt) {
				throw new ConflictError("QR pass has already been used for return");
			}

			// Serialize with expire/cancel on the leave row (mirrors the
			// RETURN path): without the lock, an expiry racing an exit
			// could leave an exit movement on a non-approved leave.
			const exitLeave = await leaveRepository.findByIdForUpdate(
				pass.leaveRequestId,
				tx
			);

			if (!exitLeave) {
				throw new NotFoundError("LeaveRequest");
			}

			// Re-check the window inside the transaction: exit allowed from
			// departure day till the day before return date.
			const now = new Date();
			const validFrom = exitLeave.startAt ?? passInTx.validFrom;
			const returnExpiry = exitLeave.endAt
				? getQrReturnExpiry(exitLeave.endAt)
				: (passInTx.expiresAt ? endOfDayIst(passInTx.expiresAt) : null);
			const isExitExpired = isRecurring
				? Boolean(returnExpiry && now > returnExpiry)
				: (passInTx.expiresAt && now > endOfDayIst(passInTx.expiresAt)) ||
				  (Boolean(exitLeave.startAt && exitLeave.endAt) && now > getQrExitExpiry(exitLeave.startAt, exitLeave.endAt));

			if (validFrom && now < startOfDayIst(validFrom)) {
				throw new ConflictError(
					`QR pass is not valid until ${validFrom.toISOString()}`
				);
			}

			if (isExitExpired) {
				throw new ConflictError("QR pass has expired");
			}

			if (
				exitLeave.status !== LEAVE_REQUEST_STATUS.APPROVED &&
				exitLeave.status !== LEAVE_REQUEST_STATUS.OVERDUE
			) {
				throw new ConflictError(
					`Cannot exit on leave in ${exitLeave.status} status`
				);
			}

			const student = await studentRepository.findById(pass.studentId, tx);

			if (!student) {
				throw new ConflictError("Student not found for QR pass");
			}

			// Contract T4: the exit scan is the physical transition. The student
			// exits from their ACTUAL location — IN_HOSTEL under the new model,
			// or legacy APPROVED_LEAVE for rows created before the temporal fix.
			// recordMovement validates the transition against the state machine
			// (so scanning while already outside/overdue fails with a 409).
			const fromState = student.currentLocationState as MovementState;

			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "EXIT_SCAN",
				scanResult: "SUCCESS",
			}, tx);

			// Guarded transition: null means a concurrent scan/invalidate
			// won the race after our re-read — fail, don't double-exit.
			const firstScanned = await qrPassRepository.markAsFirstScanned(pass.id, tx);
			if (!firstScanned) {
				throw new ConflictError("QR pass was concurrently scanned or invalidated");
			}

			const movementEvent = await recordMovement({
				studentId: pass.studentId,
				leaveRequestId: pass.leaveRequestId,
				qrPassId: pass.id,
				fromState,
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
		} catch (error) {
			const failureReason = error instanceof Error ? error.message : "Transaction failed";
			try {
				await qrScanLogRepository.create({
					qrPassId: auditQrPassId,
					scannedBy: input.scannedBy,
					scanType: "EXIT_SCAN",
					scanResult: "FAILED",
					failureReason,
					metadata: { tokenHash },
				});
			} catch (logErr) {
				logger.error("Failed to persist failed QR scan audit log after transaction rollback", {
					error: logErr instanceof Error ? logErr.message : String(logErr),
					qrPassId: auditQrPassId,
				});
			}
			throw error;
		}
	}

	if (input.scanType === "RETURN_SCAN") {
		let auditQrPassId: string | null = pass.id;
		try {
			return await transaction(async (tx) => {
				// Re-validate the pass inside the transaction — the snapshot read
				// above may be stale (a concurrent invalidate/cancel can win the
				// race between the two reads).
				const passInTx = await qrPassRepository.findById(pass.id, tx);
				if (passInTx) auditQrPassId = passInTx.id;

			if (!passInTx || passInTx.status !== QR_STATUS.ACTIVE) {
				throw new ConflictError("QR pass is no longer active");
			}

			if (passInTx.tokenHash !== pass.tokenHash) {
				throw new ConflictError("QR pass token has been rotated");
			}

			if (passInTx.closedAt) {
				throw new ConflictError("QR pass has already been used for return");
			}

			// Serialize with cancel/expire/override on the leave row. Without
			// this lock, a RETURN scan racing a cancel could resurrect a
			// CANCELLED leave as COMPLETED (the old code wrote COMPLETED with
			// no state guard against a stale snapshot).
			const leave = await leaveRepository.findByIdForUpdate(
				pass.leaveRequestId,
				tx
			);

			if (!leave) {
				throw new NotFoundError("LeaveRequest");
			}

			const now = new Date();
			const validFrom = leave.startAt ?? passInTx.validFrom;

			if (validFrom && now < startOfDayIst(validFrom)) {
				throw new ConflictError(
					`QR pass is not valid until ${validFrom.toISOString()}`
				);
			}

			const returnExpiry = leave.endAt
				? getQrReturnExpiry(leave.endAt)
				: (passInTx.expiresAt ? endOfDayIst(passInTx.expiresAt) : null);

			if (returnExpiry && now > returnExpiry) {
				throw new ConflictError("QR pass has expired");
			}

			const openSession =
				await qrPassRepository.findOpenSessionPassForStudent(
					pass.studentId,
					tx
				);
			const sessionError = returnSessionError(openSession, passInTx, isRecurring);

			if (sessionError) {
				throw new ConflictError(sessionError);
			}

			if (
				leave.status !== LEAVE_REQUEST_STATUS.APPROVED &&
				leave.status !== LEAVE_REQUEST_STATUS.OVERDUE
			) {
				throw new ConflictError(
					`Cannot complete leave in ${leave.status} status`
				);
			}

			const student = await studentRepository.findById(pass.studentId, tx);

			if (!student) {
				throw new ConflictError("Student not found for QR pass");
			}

			const fromState = student.currentLocationState as MovementState;

			const todayScans = isRecurring
				? await qrScanLogRepository.countTodaySuccessfulScans(
						pass.id,
						startOfDayIst(now),
						endOfDayIst(now),
						tx
				  )
				: null;

			const log = await qrScanLogRepository.create({
				qrPassId: pass.id,
				scannedBy: input.scannedBy,
				scanType: "RETURN_SCAN",
				scanResult: "SUCCESS",
			}, tx);

			// For recurring passes, only close the pass and complete the leave on the final day:
			// - When 2 scans have completed today (todayScans.returnCount >= 1 before this scan)
			// - Or when the return scan happens at/after the leave end time (now >= leave.endAt).
			// Intermediate daily returns keep the pass ACTIVE and leave APPROVED.
			const isFinalDay = leave.endAt ? now >= startOfDayIst(leave.endAt) : true;
			const isFinalReturn =
				!isRecurring ||
				!leave.endAt ||
				(isFinalDay && ((todayScans?.returnCount ?? 0) >= 1 || now >= leave.endAt));

			if (isFinalReturn) {
				const closed = await qrPassRepository.markAsClosed(pass.id, tx);
				if (!closed) {
					throw new ConflictError("QR pass was concurrently returned or invalidated");
				}
			} else {
				await qrPassRepository.resetFirstScan(pass.id, tx);
			}

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

			if (isFinalReturn) {
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
						oldStatus: leave.status,
						newStatus: LEAVE_REQUEST_STATUS.COMPLETED,
						completedAt: completedAt.toISOString(),
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
			}

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
		} catch (error) {
			const failureReason = error instanceof Error ? error.message : "Transaction failed";
			try {
				await qrScanLogRepository.create({
					qrPassId: auditQrPassId,
					scannedBy: input.scannedBy,
					scanType: "RETURN_SCAN",
					scanResult: "FAILED",
					failureReason,
					metadata: { tokenHash },
				});
			} catch (logErr) {
				logger.error("Failed to persist failed QR scan audit log after transaction rollback", {
					error: logErr instanceof Error ? logErr.message : String(logErr),
					qrPassId: auditQrPassId,
				});
			}
			throw error;
		}
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
