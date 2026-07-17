import { getConfig } from "./config"
import type { EmailProvider } from "./email/provider"
import { ResendEmailProvider } from "./email/resend"
import { SesEmailProvider } from "./email/ses"
import type { SmsProvider } from "./sms/provider"
import { Msg91SmsProvider } from "./sms/msg91"
import { TwilioSmsProvider } from "./sms/twilio"

export type { EmailPayload, EmailProvider, EmailResult } from "./email/provider"
export { EmailTemplate } from "./email/provider"
export type { SmsPayload, SmsProvider, SmsResult } from "./sms/provider"
export { SmsTemplate } from "./sms/provider"
export type { MessagingConfig } from "./config"
export { getConfig, reloadConfig } from "./config"

let smsProviderInstance: SmsProvider | null = null
let emailProviderInstance: EmailProvider | null = null

export function createSmsProvider(): SmsProvider {
  if (!smsProviderInstance) {
    const config = getConfig()
    switch (config.sms.provider) {
      case "msg91":
        smsProviderInstance = new Msg91SmsProvider()
        break
      case "twilio":
        smsProviderInstance = new TwilioSmsProvider()
        break
      default:
        throw new Error(`Unknown SMS provider: ${config.sms.provider}`)
    }
  }
  return smsProviderInstance
}

export function createEmailProvider(): EmailProvider {
  if (!emailProviderInstance) {
    const config = getConfig()
    switch (config.email.provider) {
      case "ses":
        emailProviderInstance = new SesEmailProvider()
        break
      case "resend":
        emailProviderInstance = new ResendEmailProvider()
        break
      default:
        throw new Error(`Unknown email provider: ${config.email.provider}`)
    }
  }
  return emailProviderInstance
}

export function resetProviders(): void {
  smsProviderInstance = null
  emailProviderInstance = null
}
