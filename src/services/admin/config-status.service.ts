import { getConfig } from "@/lib/messaging"

export type ProviderHealthStatus = {
  healthy: boolean
  provider: string
}

export type ConfigStatus = {
  sms: {
    configured: boolean
    provider: string
    authKey: boolean
    senderId: boolean
  }
  email: {
    configured: boolean
    provider: string
    region: boolean
    fromEmail: boolean
  }
  slack: {
    configured: boolean
    botToken: boolean
    channelId: boolean
  }
  system: {
    baseUrl: boolean
    appUrl: boolean
    authSecret: boolean
  }
}

export function getConfigStatus(): ConfigStatus {
  const config = getConfig()

  const smsAuthKey = !!config.sms.msg91?.authKey
  const smsSenderId = !!config.sms.msg91?.senderId
  const smsConfigured = config.sms.provider === "twilio"
    ? (!!config.sms.twilio?.accountSid && !!config.sms.twilio?.authToken && !!config.sms.twilio?.fromNumber)
    : (smsAuthKey && smsSenderId)

  const emailRegion = !!config.email.ses?.region
  const emailFromEmail = !!config.email.ses?.fromEmail
  const emailConfigured = config.email.provider === "resend"
    ? (!!config.email.resend?.apiKey && !!config.email.resend?.fromEmail)
    : (emailRegion && emailFromEmail)

  const slackBotToken = !!process.env.SLACK_BOT_TOKEN
  const slackChannelId = !!process.env.SLACK_CHANNEL_ID
  const baseUrl = !!process.env.NEXT_PUBLIC_BASE_URL
  const appUrl = !!process.env.NEXT_PUBLIC_APP_URL
  const authSecret = !!process.env.AUTH_SECRET

  return {
    sms: {
      configured: smsConfigured,
      provider: config.sms.provider,
      authKey: smsAuthKey,
      senderId: smsSenderId,
    },
    email: {
      configured: emailConfigured,
      provider: config.email.provider,
      region: emailRegion,
      fromEmail: emailFromEmail,
    },
    slack: {
      configured: slackBotToken && slackChannelId,
      botToken: slackBotToken,
      channelId: slackChannelId,
    },
    system: {
      baseUrl,
      appUrl,
      authSecret,
    },
  }
}
