/**
 * portfolio router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::portfolio.portfolio', {
  config: {
    find: {
      middlewares: [],
      policies: []
    },
    findOne: {
      middlewares: [],
      policies: ['api::portfolio.is-owner']
    },
    create: {
      middlewares: [],
      policies: []
    },
    update: {
      middlewares: [],
      policies: ['api::portfolio.is-owner']
    },
    delete: {
      middlewares: [],
      policies: ['api::portfolio.is-owner']
    }
  }
});
