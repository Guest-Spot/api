/**
 * shop router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::shop.shop', {
  config: {
    find: {
      middlewares: [],
      policies: ['global::filter-blocked']
    },
    findOne: {
      middlewares: [],
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::shop.shop'
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
          serviceName: 'api::shop.shop'
        }
      }]
    },
    delete: {
      middlewares: [],
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::shop.shop'
        }
      }]
    }
  }
});
