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
      policies: ['api::invite.is-owner']
    },
    create: {
      middlewares: [],
      policies: []
    },
    update: {
      middlewares: [],
      policies: ['api::invite.is-owner']
    },
    delete: {
      middlewares: [],
      policies: ['api::invite.is-owner']
    }
  }
});
