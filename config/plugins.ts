export default ({ env }) => {
  const appleClientId = env('APPLE_CLIENT_ID');
  const appleTeamId = env('APPLE_TEAM_ID');
  const appleKeyId = env('APPLE_KEY_ID');
  const applePrivateKeyRaw = env('APPLE_PRIVATE_KEY', '');
  const applePrivateKey = applePrivateKeyRaw ? applePrivateKeyRaw.replace(/\\n/g, '\n') : undefined;
  const applePrivateKeyPath = applePrivateKey ? undefined : env('APPLE_PRIVATE_KEY_PATH');
  const appleRedirectUri = env('APPLE_REDIRECT_URI');
  const appleScopeRaw = env('APPLE_SCOPE', 'name email');
  const appleScope = appleScopeRaw
    .split(/[\s,]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const appleAudience = env('APPLE_AUDIENCE', 'https://appleid.apple.com');
  const appleResponseMode = env('APPLE_RESPONSE_MODE', 'form_post');
  const appleResponseType = env('APPLE_RESPONSE_TYPE', 'code');

  const appleProviderConfig = {
    enabled: true,
    key: appleClientId,
    keyId: appleKeyId,
    teamId: appleTeamId,
    privateKey: applePrivateKey,
    privateKeyPath: applePrivateKeyPath,
    redirectUri: appleRedirectUri,
    scope: appleScope.length ? appleScope : ['name', 'email'],
    audience: appleAudience,
    responseMode: appleResponseMode,
    responseType: appleResponseType,
  };

  return {
    'users-permissions': {
      enabled: true,
      config: {
        jwt: {
          expiresIn: '15m',
        },
        providers: {
          apple: appleProviderConfig,
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
  };
};
