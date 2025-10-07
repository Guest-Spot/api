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
  ],
};
