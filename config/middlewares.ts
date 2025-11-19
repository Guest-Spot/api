export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  // {
  //   name: 'strapi::cors',
  //   config: {
  //     origin: [
  //       'http://localhost',
  //       'https://getguestspot.app',
  //       'https://getguestspot.com',
  //     ],
  //     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  //     headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  //     keepHeaderOnError: true,
  //   },
  // },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      includeUnparsed: true, // Enable access to raw body for webhook signature verification
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  // 'global::wellKnown',
];
