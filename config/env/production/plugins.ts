export default ({ env }) => ({
  email: {
    config: {
      provider: 'strapi-provider-email-resend',
      providerOptions: {
        apiKey: env('RESEND_API_KEY'), // Required
      },
      settings: {
        defaultFrom: env('EMAIL_FROM'), // Required
        defaultReplyTo: env('EMAIL_REPLY_TO'), // Required
      },
    }
  },
});