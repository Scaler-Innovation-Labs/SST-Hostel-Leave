import { PARENT_LOGIN_OTP_EXPIRY_MINUTES } from "@/constants/auth/parent-auth"
import { parentRepository } from "@/db/repositories/parent/parent.repository"
import { parentOtpSessionRepository } from "@/db/repositories/parent/parent-otp-session.repository"
import { sha256 } from "@/lib/crypto"
import { NotFoundError, ValidationError } from "@/lib/errors"
import { signParentJwt } from "@/lib/jwt"
import { sendOtpViaMsg91, verifyOtpViaMsg91 } from "@/lib/messaging/otp/msg91-otp"
import { notificationService } from "@/services/notification/notification.service"

export type SendLoginOtpResult = {
  phoneLast4: string
  sessionId: string
}

export type VerifyLoginOtpResult = {
  token: string
  parent: {
    id: string
    name: string
    phone: string
  }
}

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function isMsg91OtpConfigured(): boolean {
  return !!process.env.MSG91_OTP_TEMPLATE_ID
}

async function deliverOtp(phone: string, otpCode: string, parentId: string): Promise<void> {
  if (isMsg91OtpConfigured()) {
    await sendOtpViaMsg91(phone, otpCode)
  } else {
    const smsBody = `Your login OTP is ${otpCode}. It expires in ${PARENT_LOGIN_OTP_EXPIRY_MINUTES} minutes.`
    await notificationService.sendSms(phone, smsBody, {
      parentId,
      metadata: { purpose: "PARENT_LOGIN" },
    })
  }
}

async function checkOtp(phone: string, otp: string, storedHash: string): Promise<boolean> {
  if (isMsg91OtpConfigured()) {
    return verifyOtpViaMsg91(phone, otp)
  }
  return (await sha256(otp)) === storedHash
}

export const parentAuthService = {
  async sendOtp(phone: string): Promise<SendLoginOtpResult> {
    const parent = await parentRepository.findByPhone(phone)

    if (!parent) {
      throw new NotFoundError("Parent")
    }

    await parentOtpSessionRepository.invalidateByParentId(parent.id)

    const otpCode = generateOtpCode()
    const otpHash = await sha256(otpCode)

    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + PARENT_LOGIN_OTP_EXPIRY_MINUTES)

    const session = await parentOtpSessionRepository.create({
      parentId: parent.id,
      phone,
      otpHash,
      expiresAt,
    })

    await deliverOtp(phone, otpCode, parent.id)

    return {
      phoneLast4: phone.slice(-4),
      sessionId: session.id,
    }
  },

  async verifyOtp(phone: string, otp: string): Promise<VerifyLoginOtpResult> {
    const parent = await parentRepository.findByPhone(phone)

    if (!parent) {
      throw new NotFoundError("Parent")
    }

    const session = await parentOtpSessionRepository.findValidByPhone(phone)

    if (!session) {
      throw new NotFoundError("OTP session")
    }

    const valid = await checkOtp(phone, otp, session.otpHash)
    if (!valid) {
      throw new ValidationError("Invalid OTP")
    }

    await parentOtpSessionRepository.markVerified(session.id)

    const token = await signParentJwt(parent.id, parent.phone)

    return {
      token,
      parent: {
        id: parent.id,
        name: parent.name,
        phone: parent.phone,
      },
    }
  },
}
