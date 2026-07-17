export type SmsProviderType = "msg91" | "twilio"

export type EmailProviderType = "ses" | "resend"

export type MessagingConfig = {
  sms: {
    provider: SmsProviderType
    msg91?: {
      authKey: string
      senderId: string
    }
    twilio?: {
      accountSid: string
      authToken: string
      fromNumber: string
      messagingServiceSid?: string
    }
  }
  email: {
    provider: EmailProviderType
    ses?: {
      region: string
      accessKeyId: string
      secretAccessKey: string
      fromEmail: string
    }
    resend?: {
      apiKey: string
      fromEmail: string
    }
  }
  defaults: {
    testMode: boolean
    testRecipient?: string
  }
}

export function loadConfig(): MessagingConfig {
  return {
    sms: {
      provider: (process.env.SMS_PROVIDER as SmsProviderType) ?? "msg91",
      msg91: {
        authKey: process.env.MSG91_AUTH_KEY ?? "",
        senderId: process.env.MSG91_SENDER_ID ?? "",
      },
    },
    email: {
      provider: (process.env.EMAIL_PROVIDER as EmailProviderType) ?? "ses",
      ses: {
        region: process.env.AWS_REGION ?? "",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
        fromEmail: process.env.SES_FROM_EMAIL ?? "",
      },
      resend: {
        apiKey: process.env.RESEND_API_KEY ?? "",
        fromEmail: process.env.RESEND_FROM_EMAIL ?? "",
      },
    },
    defaults: {
      testMode: process.env.SMS_TEST_MODE === "true",
      testRecipient: process.env.SMS_TO_NUMBER,
    },
  }
}

let cachedConfig: MessagingConfig | null = null

export function getConfig(): MessagingConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig()
  }
  return cachedConfig
}

export function reloadConfig(): MessagingConfig {
  cachedConfig = loadConfig()
  return cachedConfig
}
