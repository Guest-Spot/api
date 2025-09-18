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
      policies: []
    },
    create: {
      middlewares: [],
      policies: ['api::shop.is-owner']
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
