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
      policies: []
    },
    create: {
      middlewares: [],
      policies: ['api::trip.is-owner']
    },
    update: {
      middlewares: [],
      policies: ['api::trip.is-owner']
    },
    delete: {
      middlewares: [],
      policies: ['api::trip.is-owner']
    }
  }
});
