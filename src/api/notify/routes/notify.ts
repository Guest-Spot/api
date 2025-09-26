/**
 * notify router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::notify.notify', {
  config: {
    find: {
      middlewares: [],
      policies: [{
        name: 'global::filter-owner-data',
        config: {
          ownerField: ['ownerDocumentId', 'recipientDocumentId']
        }
      }]
    },
    findOne: {
      middlewares: [],
      policies: [{
        name: 'global::filter-owner-data',
        config: {
          ownerField: ['ownerDocumentId', 'recipientDocumentId']
        }
      }]
    },
    create: {
      middlewares: [],
      policies: []
    },
    update: {
      middlewares: [],
      policies: ['api::notify.is-owner']
    },
    delete: {
      middlewares: [],
      policies: ['api::notify.is-owner']
    }
  }
});
