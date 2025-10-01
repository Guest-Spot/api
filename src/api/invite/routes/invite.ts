/**
 * invite router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::invite.invite', {
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
      policies: []
    },
    update: {
      middlewares: [],
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['sender', 'recipient'],
          serviceName: 'api::invite.invite'
        }
      }]
    },
    delete: {
      middlewares: [],
      policies: [{
        name: 'global::is-owner',
        config: {
          ownerField: ['sender', 'recipient'],
          serviceName: 'api::invite.invite'
        }
      }]
    }
  }
});
