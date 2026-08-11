import { getConfig } from "./config"
import type { EmailProvider } from "./email/provider"
import { ResendEmailProvider } from "./email/resend"
import { SesEmailProvider } from "./email/ses"
import { SstEmailProvider } from "./email/sst-service"
import { InfobipSmsProvider } from "./sms/infobip"
import type { SmsProvider } from "./sms/provider"

export type { MessagingConfig } from "./config"
export { reloadConfig } from "./config"
export type { EmailPayload, EmailProvider, EmailResult } from "./email/provider"
export { EmailTemplate } from "./email/provider"
export type { SmsPayload, SmsProvider, SmsResult } from "./sms/provider"
export { SmsTemplate } from "./sms/provider"

let smsProviderInstance: SmsProvider | null = null
let emailProviderInstance: EmailProvider | null = null

export function createSmsProvider(): SmsProvider {
  if (!smsProviderInstance) {
    smsProviderInstance = new InfobipSmsProvider()
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
      case "sst":
        emailProviderInstance = new SstEmailProvider()
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
