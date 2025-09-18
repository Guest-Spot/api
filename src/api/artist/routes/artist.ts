/**
 * artist router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::artist.artist', {
  config: {
    find: {
      middlewares: [],
      policies: []
    },
    findOne: {
      middlewares: [],
      policies: []
    },
    create: {
      middlewares: [],
      policies: ['api::artist.is-owner']
    },
    update: {
      middlewares: [],
      policies: ['api::artist.is-owner']
    },
    delete: {
      middlewares: [],
      policies: ['api::artist.is-owner']
    }
  }
});
