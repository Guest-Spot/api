/**
 * artist router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::artist.artist', {
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
          serviceName: 'api::artist.artist'
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
          serviceName: 'api::artist.artist'
        }
      }]
    },
    delete: {
      middlewares: [],
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['documentId'],
          serviceName: 'api::artist.artist'
        }
      }]
    }
  }
});
