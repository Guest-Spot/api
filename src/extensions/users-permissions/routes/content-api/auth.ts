export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/local',
      handler: 'auth.callback',
      config: {
        auth: false,
        prefix: '',
      },
    },
    {
      method: 'GET',
      path: '/auth/:provider/callback',
      handler: 'auth.callback',
      config: {
        auth: false,
        prefix: '',
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/connect/(.*)',
      handler: 'auth.connect',
      config: {
        auth: false,
        prefix: '',
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/connect/(.*)',
      handler: 'auth.connect',
      config: {
        auth: false,
        prefix: '',
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/auth/:provider/callback',
      handler: 'auth.callback',
      config: {
        auth: false,
        prefix: '',
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/auth/refreshToken',
      handler: 'auth.refreshToken',
      config: {
        auth: false,
        prefix: '',
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/auth/logout',
      handler: 'auth.logout',
      config: {
        auth: false,
        prefix: '',
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/auth/email-exists',
      handler: 'auth.emailExists',
      config: {
        auth: false,
        prefix: '',
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/auth/username-exists',
      handler: 'auth.usernameExists',
      config: {
        auth: false,
        prefix: '',
        policies: [],
      },
    },
  ],
};
