/**
 * booking router
 */

import { factories } from '@strapi/strapi';

const defaultRouter = factories.createCoreRouter('api::booking.booking');

const customRouter = (innerRouter, extraRoutes = []) => {
  let routes;
  return {
    get prefix() {
      return innerRouter.prefix;
    },
    get routes() {
      if (!routes) routes = [...extraRoutes, ...innerRouter.routes];
      return routes;
    },
  };
};

const myExtraRoutes = [
  {
    method: 'POST',
    path: '/bookings/:bookingDocumentId/create-payment',
    handler: 'booking.createPayment',
    config: {
      policies: [],
      middlewares: [],
    },
  },
  {
    method: 'GET',
    path: '/bookings/statistics',
    handler: 'booking.statistics',
    config: {
      auth: false,
      policies: ['global::admin-auth'],
      middlewares: [],
    },
  },
];

export default customRouter(defaultRouter, myExtraRoutes);
