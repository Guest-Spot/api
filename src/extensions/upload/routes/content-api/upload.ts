export default {
  routes: [
    {
      method: 'POST',
      path: '/upload',
      handler: 'upload.upload',
      config: {
        auth: false, // Optional auth - will be checked in controller if needed
        prefix: '',
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/upload/create-folder',
      handler: 'upload.createFolder',
      config: {
        auth: false, // Optional auth - will be checked in controller if needed
        prefix: '',
        policies: [],
        middlewares: [],
      },
    },
  ],
};

