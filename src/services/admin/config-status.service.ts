export type ConfigStatus = {
  email: {
    configured: boolean;
    apiKey: boolean;
    fromEmail: boolean;
  };
  sms: {
    configured: boolean;
    accountSid: boolean;
    authToken: boolean;
    phoneNumber: boolean;
  };
  slack: {
    configured: boolean;
    botToken: boolean;
    channelId: boolean;
  };
  system: {
    baseUrl: boolean;
    appUrl: boolean;
    authSecret: boolean;
  };
};

export function getConfigStatus(): ConfigStatus {
  const resendApiKey = !!process.env.RESEND_API_KEY;
  const resendFromEmail = !!process.env.RESEND_FROM_EMAIL;
  const twilioAccountSid = !!process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = !!process.env.TWILIO_PHONE_NUMBER;
  const slackBotToken = !!process.env.SLACK_BOT_TOKEN;
  const slackChannelId = !!process.env.SLACK_CHANNEL_ID;
  const baseUrl = !!process.env.NEXT_PUBLIC_BASE_URL;
  const appUrl = !!process.env.NEXT_PUBLIC_APP_URL;
  const authSecret = !!process.env.AUTH_SECRET;

  return {
    email: {
      configured: resendApiKey && resendFromEmail,
      apiKey: resendApiKey,
      fromEmail: resendFromEmail,
    },
    sms: {
      configured: twilioAccountSid && twilioAuthToken && twilioPhoneNumber,
      accountSid: twilioAccountSid,
      authToken: twilioAuthToken,
      phoneNumber: twilioPhoneNumber,
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
  };
}
