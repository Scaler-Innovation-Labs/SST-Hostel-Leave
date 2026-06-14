import { PARENT_LOGIN_OTP_EXPIRY_MINUTES } from "@/constants/auth/parent-auth";
import { parentOtpSessionRepository } from "@/db/repositories/hostel/parent-otp-session.repository";
import { parentRepository } from "@/db/repositories/hostel/parent.repository";
import { signParentJwt } from "@/lib/jwt";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { notificationService } from "@/services/notification/notification.service";

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type SendLoginOtpResult = {
  phoneLast4: string;
  sessionId: string;
};

export type VerifyLoginOtpResult = {
  token: string;
  parent: {
    id: string;
    name: string;
    phone: string;
  };
};

export const parentAuthService = {
  async sendOtp(phone: string): Promise<SendLoginOtpResult> {
    const parent = await parentRepository.findByPhone(phone);

    if (!parent) {
      throw new NotFoundError("Parent");
    }

    await parentOtpSessionRepository.invalidateByParentId(parent.id);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await sha256(otp);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + PARENT_LOGIN_OTP_EXPIRY_MINUTES);

    const session = await parentOtpSessionRepository.create({
      parentId: parent.id,
      phone,
      otpHash,
      expiresAt,
    });

    await notificationService.sendSms(
      phone,
      `Your SST Hostel login OTP: ${otp}. Valid for ${PARENT_LOGIN_OTP_EXPIRY_MINUTES} minutes.`,
    );

    return {
      phoneLast4: phone.slice(-4),
      sessionId: session.id,
    };
  },

  async verifyOtp(phone: string, otp: string): Promise<VerifyLoginOtpResult> {
    const parent = await parentRepository.findByPhone(phone);

    if (!parent) {
      throw new NotFoundError("Parent");
    }

    const session = await parentOtpSessionRepository.findValidByPhone(phone);

    if (!session) {
      throw new NotFoundError("OTP session");
    }

    const otpHash = await sha256(otp);

    if (otpHash !== session.otpHash) {
      throw new ValidationError("Invalid OTP");
    }

    await parentOtpSessionRepository.markVerified(session.id);

    const token = await signParentJwt(parent.id, parent.phone);

    return {
      token,
      parent: {
        id: parent.id,
        name: parent.name,
        phone: parent.phone,
      },
    };
  },
};

