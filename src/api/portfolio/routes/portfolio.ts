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
      policies: []
    },
    create: {
      middlewares: [],
      policies: ['api::portfolio.is-owner']
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
