import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { QR_STATUS } from "@/constants/movement/qr-status";
import type { QrType } from "@/constants/movement/qr-type";
import { getQrExpiryFromLeaveEnd } from "@/constants/movement/qr-window";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { sha256, toHex } from "@/lib/crypto";
import { db } from "@/lib/db";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type GenerateQrInput = {
	leaveRequestId: string;
	userId: string;
	qrType: QrType;
}

export type QrPassResult = {
	passId: string;
	token: string;
	tokenHash: string;
	qrType: string;
	expiresAt: Date | null;
}

function generateToken(): string {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  return toHex(raw);
}

export async function generateQrPass(
	input: GenerateQrInput
): Promise<QrPassResult> {
	const student = await studentRepository.findByUserId(input.userId);
	if (!student) {
		throw new AuthorizationError("Only students can generate QR passes");
	}

	return await db.transaction(async (tx) => {
		// Row-lock the leave so two concurrent generate calls for the same
		// leave serialize: the second blocks until the first commits, then
		// sees the existing pass and returns its stored token instead of
		// racing to create a duplicate (which the unique index would reject
		// with an opaque 500).
		const leaveRequest = await leaveRepository.findByIdForUpdate(
			input.leaveRequestId,
			tx
		);

		if (!leaveRequest) {
			throw new NotFoundError("Leave request not found");
		}

		if (leaveRequest.studentId !== student.id) {
			throw new AuthorizationError("You can only generate QR passes for your own leaves");
		}

		if (leaveRequest.status !== LEAVE_REQUEST_STATUS.APPROVED) {
			throw new ValidationError(
				"Leave request must be approved to generate QR"
			);
		}

		const leaveType = await leaveTypeRepository.findById(
			leaveRequest.leaveTypeId,
			tx
		);

		if (!leaveType) {
			throw new NotFoundError("LeaveType");
		}

		if (leaveType.qrMode === "NONE") {
			throw new ValidationError("QR generation is not allowed for this leave type");
		}

		if (leaveType.qrMode === "EXIT_ONLY" && input.qrType !== "LEAVE_EXIT") {
			throw new ValidationError("Only exit QR can be generated for this leave type");
		}

		if (leaveType.qrMode === "RETURN_ONLY" && input.qrType !== "LEAVE_RETURN") {
			throw new ValidationError("Only return QR can be generated for this leave type");
		}

		const existingPass = await qrPassRepository.findByLeaveRequestId(
			input.leaveRequestId,
			tx
		);

		// Contract §2: the pass is window-gated. validFrom = leave startAt;
		// expiresAt = leave endAt + return grace. The token may only be used
		// inside that window (enforced at scan time). The expiry is ALWAYS
		// derived server-side — a client-supplied value could extend the
		// credential beyond the authorized leave window.
		const validFrom = leaveRequest.startAt;
		const expiresAt = getQrExpiryFromLeaveEnd(leaveRequest.endAt);
		const now = new Date();

		const token = generateToken();
		const tokenHash = await sha256(token);

		// Contract §7 invariant: a student may have at most ONE currently
		// usable-for-exit pass. Future approved leaves hold ACTIVE passes
		// OUTSIDE their window — those do not count and do not block. Creating
		// or re-issuing a credential while ANOTHER in-window pass exists would
		// create the ambiguity the contract forbids.
		//
		// Only checked when we are about to mint/refresh a credential; the
		// "return the stored token" path below never creates a second usable
		// pass.
		if (
			!existingPass ||
			existingPass.status !== QR_STATUS.ACTIVE
		) {
			const conflicting = await qrPassRepository.findUsableExitPassForStudent(
				student.id,
				existingPass?.id ?? "",
				now,
				tx
			);

			if (conflicting) {
				throw new ValidationError(
					"Another QR pass is currently active for a conflicting leave. Resolve it before generating a new one."
				);
			}
		}

		if (existingPass) {
			if (
				existingPass.status === QR_STATUS.ACTIVE &&
				existingPass.token
			) {
				// One QR pass (and one stable token) per leave: an ACTIVE pass
				// simply returns its stored token so the student can display
				// the exact same QR again.
				return {
					passId: existingPass.id,
					token: existingPass.token,
					tokenHash: existingPass.tokenHash,
					qrType: existingPass.qrType,
					expiresAt: existingPass.expiresAt,
				};
			}

			if (existingPass.status === QR_STATUS.ACTIVE) {
				// Legacy pass (no stored raw token) — write the token once so it
				// can be rendered again. This is a repair, not a re-issue.
				const pass = await qrPassRepository.regenerate(
					existingPass.id,
					{ tokenHash, qrType: input.qrType, validFrom, expiresAt, token },
					tx
				);

				await auditService.record(
					AUDIT_ACTION.UPDATE,
					AUDIT_ENTITY_TYPE.QR_PASS,
					pass.id,
					input.userId,
					{
						qrType: input.qrType,
						leaveRequestId: input.leaveRequestId,
						reason: "legacy pass repair (missing raw token)",
					},
					tx
				);

				await outboxService.publish({
					eventType: OUTBOX_EVENT_TYPE.QR_GENERATED,
					aggregateType: AGGREGATE_TYPE.QR_PASS,
					aggregateId: pass.id,
					payload: {
						qrPassId: pass.id,
						leaveRequestId: input.leaveRequestId,
						studentId: student.id,
						qrType: input.qrType,
					},
				}, tx);

				return {
					passId: pass.id,
					token,
					tokenHash,
					qrType: pass.qrType,
					expiresAt: pass.expiresAt,
				};
			}

			if (
				!existingPass.firstScanAt &&
				!existingPass.closedAt
			) {
				// Contract §7: an INVALIDATED-but-never-used pass (e.g. the old
				// dashboard auto-reveal bug, or an admin invalidation of an
				// unused credential) may be re-issued with a FRESH token on the
				// same row — the leave is still APPROVED (checked above), so a
				// new credential is legitimate. A used/closed pass is dead for
				// good.
				const pass = await qrPassRepository.regenerate(
					existingPass.id,
					{ tokenHash, qrType: input.qrType, validFrom, expiresAt, token },
					tx
				);

				await auditService.record(
					AUDIT_ACTION.UPDATE,
					AUDIT_ENTITY_TYPE.QR_PASS,
					pass.id,
					input.userId,
					{
						qrType: input.qrType,
						leaveRequestId: input.leaveRequestId,
						reason: "re-issued invalidated-but-unused pass",
					},
					tx
				);

				await outboxService.publish({
					eventType: OUTBOX_EVENT_TYPE.QR_GENERATED,
					aggregateType: AGGREGATE_TYPE.QR_PASS,
					aggregateId: pass.id,
					payload: {
						qrPassId: pass.id,
						leaveRequestId: input.leaveRequestId,
						studentId: student.id,
						qrType: input.qrType,
					},
				}, tx);

				return {
					passId: pass.id,
					token,
					tokenHash,
					qrType: pass.qrType,
					expiresAt: pass.expiresAt,
				};
			}

			return {
				passId: existingPass.id,
				token: "",
				tokenHash: existingPass.tokenHash,
				qrType: existingPass.qrType,
				expiresAt: existingPass.expiresAt,
			};
		}

		const pass = await qrPassRepository.create({
			leaveRequestId: input.leaveRequestId,
			studentId: student.id,
			qrType: input.qrType,
			tokenHash,
			token,
			status: QR_STATUS.ACTIVE,
			validFrom,
			expiresAt,
		}, tx);

		await auditService.record(
			AUDIT_ACTION.CREATE,
			AUDIT_ENTITY_TYPE.QR_PASS,
			pass.id,
			input.userId,
			{
				qrType: input.qrType,
				leaveRequestId: input.leaveRequestId,
			},
			tx
		);

		await outboxService.publish({
			eventType: OUTBOX_EVENT_TYPE.QR_GENERATED,
			aggregateType: AGGREGATE_TYPE.QR_PASS,
			aggregateId: pass.id,
			payload: {
				qrPassId: pass.id,
				leaveRequestId: input.leaveRequestId,
				studentId: student.id,
				qrType: input.qrType,
			},
		}, tx);

		return {
			passId: pass.id,
			token,
			tokenHash,
			qrType: pass.qrType,
			expiresAt: pass.expiresAt,
		};
	});
}
