import { getConfig } from "@/lib/messaging"

export type ConfigStatus = {
  email: {
    configured: boolean
    apiKey: boolean
    fromEmail: boolean
  }
  sms: {
    configured: boolean
    accountSid: boolean
    authToken: boolean
    phoneNumber: boolean
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

  const emailApiKey = !!config.email.resend?.apiKey
  const emailFromEmail = !!config.email.resend?.fromEmail
  const emailConfigured = emailApiKey && emailFromEmail

  const smsAccountSid = !!config.sms.twilio?.accountSid
  const smsAuthToken = !!config.sms.twilio?.authToken
  const smsPhoneNumber = !!config.sms.twilio?.fromNumber
  const smsConfigured = smsAccountSid && smsAuthToken && smsPhoneNumber

  const slackBotToken = !!process.env.SLACK_BOT_TOKEN
  const slackChannelId = !!process.env.SLACK_CHANNEL_ID
  const baseUrl = !!process.env.NEXT_PUBLIC_BASE_URL
  const appUrl = !!process.env.NEXT_PUBLIC_APP_URL
  const authSecret = !!process.env.AUTH_SECRET

  return {
    email: {
      configured: emailConfigured,
      apiKey: emailApiKey,
      fromEmail: emailFromEmail,
    },
    sms: {
      configured: smsConfigured,
      accountSid: smsAccountSid,
      authToken: smsAuthToken,
      phoneNumber: smsPhoneNumber,
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
