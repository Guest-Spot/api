export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/local',
      handler: 'auth.callback',
      config: {
        middlewares: ['plugin::users-permissions.ratelimit'],
        prefix: '',
      },
    },
    {
      method: 'POST',
      path: '/auth/refreshToken',
      handler: 'auth.refreshToken',
      config: {
        middlewares: ['plugin::users-permissions.ratelimit'],
        prefix: '',
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/auth/logout',
      handler: 'auth.logout',
      config: {
        prefix: '',
        policies: [],
      },
    },
  ],
};
