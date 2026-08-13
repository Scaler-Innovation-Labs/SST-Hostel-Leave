export type ConfigStatus = {
  email: {
    configured: boolean
    apiKey: boolean
    fromEmail: boolean
  }
  sms: {
    configured: boolean
    apiKey: boolean
    senderId: boolean
  }
  slack: {
    configured: boolean
    botToken: boolean
    channelId: boolean
    pocChannelId: boolean
  }
  system: {
    baseUrl: boolean
    appUrl: boolean
    authSecret: boolean
  }
}

export function getConfigStatus(): ConfigStatus {
  const emailApiKey = !!process.env.EMAIL_SERVICE_API_KEY
  const emailFromEmail = !!process.env.EMAIL_SERVICE_URL
  const emailConfigured = emailApiKey && emailFromEmail

  const smsApiKey = !!process.env.INFOBIP_API_KEY
  const smsSenderId = !!process.env.INFOBIP_SENDER_ID
  const smsConfigured = smsApiKey && smsSenderId

  const slackBotToken = !!process.env.SLACK_BOT_TOKEN
  const slackChannelId = !!process.env.SLACK_CHANNEL_ID
  const slackPocChannelId = !!process.env.SLACK_POC_CHANNEL_ID
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
      apiKey: smsApiKey,
      senderId: smsSenderId,
    },
    slack: {
      configured: slackBotToken && slackChannelId,
      botToken: slackBotToken,
      channelId: slackChannelId,
      pocChannelId: slackPocChannelId,
    },
    system: {
      baseUrl,
      appUrl,
      authSecret,
    },
  }
}
