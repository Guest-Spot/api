/**
 * guest router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::guest.guest', {
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
          serviceName: 'api::guest.guest'
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
          serviceName: 'api::guest.guest'
        }
      }]
    },
    delete: {
      middlewares: [],
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::guest.guest'
        }
      }]
    }
  }
});
