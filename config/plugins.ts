export default ({ env }) => ({
  'users-permissions': {
    enabled: true,
    config: {
      jwt: {
        expiresIn: '15m',
      },
    },
  },
  'graphql': {
    enabled: true,
    config: {
      endpoint: '/graphql',
      shadowCRUD: true,
      landingPage: true,
      depthLimit: 7,
      amountLimit: 100,
      apolloServer: {
        tracing: false,
      },
    },
  },
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
  'media-prefix': {
    enabled: true,
  },
});