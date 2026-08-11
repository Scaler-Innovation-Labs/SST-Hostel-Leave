export type EmailProviderType = "ses" | "resend" | "sst"

export type MessagingConfig = {
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
