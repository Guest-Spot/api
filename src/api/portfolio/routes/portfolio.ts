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
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::portfolio.portfolio'
        }
      }]
    },
    create: {
      middlewares: [],
      policies: []
    },
    update: {
      middlewares: [],
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::portfolio.portfolio'
        }
      }]
    },
    delete: {
      middlewares: [],
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::portfolio.portfolio'
        }
      }]
    }
  }
});
