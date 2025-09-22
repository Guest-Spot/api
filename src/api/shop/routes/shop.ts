/**
 * shop router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::shop.shop', {
  config: {
    find: {
      middlewares: [],
      policies: []
    },
    findOne: {
      middlewares: [],
      policies: ['api::shop.is-owner']
    },
    create: {
      middlewares: [],
      policies: []
    },
    update: {
      middlewares: [],
      policies: ['api::shop.is-owner']
    },
    delete: {
      middlewares: [],
      policies: ['api::shop.is-owner']
    }
  }
});
