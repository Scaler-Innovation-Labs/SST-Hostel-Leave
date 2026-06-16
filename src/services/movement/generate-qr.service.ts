import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { QR_STATUS } from "@/constants/movement/qr-status";
import type { QrType } from "@/constants/movement/qr-type";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { db } from "@/lib/db";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { sha256, toHex } from "@/lib/crypto";

export type GenerateQrInput = {
	leaveRequestId: string;
	userId: string;
	qrType: QrType;
	expiresAt?: Date;
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
		const leaveRequest = await leaveRepository.findById(
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

		const existingPass = await qrPassRepository.findByLeaveRequestId(
			input.leaveRequestId,
			tx
		);

		const token = generateToken();
		const tokenHash = await sha256(token);
		const expiresAt = input.expiresAt ?? null;

		if (existingPass) {
			if (existingPass.status === QR_STATUS.ACTIVE) {
				return {
					passId: existingPass.id,
					token: "",
					tokenHash: existingPass.tokenHash,
					qrType: existingPass.qrType,
					expiresAt: existingPass.expiresAt,
				};
			}

			const pass = await qrPassRepository.regenerate(
				existingPass.id,
				{ tokenHash, qrType: input.qrType, expiresAt },
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

		const pass = await qrPassRepository.create({
			leaveRequestId: input.leaveRequestId,
			studentId: student.id,
			qrType: input.qrType,
			tokenHash,
			status: QR_STATUS.ACTIVE,
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
