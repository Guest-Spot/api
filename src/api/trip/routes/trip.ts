/**
 * trip router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::trip.trip', {
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
          ownerField: ['ownerDocumentId'],
          serviceName: 'api::trip.trip'
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
          ownerField: ['ownerDocumentId'],
          serviceName: 'api::trip.trip'
        }
      }]
    },
    delete: {
      middlewares: [],
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['ownerDocumentId'],
          serviceName: 'api::trip.trip'
        }
      }]
    }
  }
});
