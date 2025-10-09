import { citiesExtension } from './extensions/graphql/cities';
import { shopArtistsExtension } from './extensions/graphql/shop-artists';
import { grapqlGuards } from './extensions/graphql/guards';
import { usersPermissionsExtension } from './extensions/users-permissions';
import { registerAppleAuthProvider } from './extensions/users-permissions/providers/apple';

import authRoutes from './extensions/users-permissions/routes/content-api/auth';
import authController from './extensions/users-permissions/controllers/auth';

import userLifecycles from './extensions/users-permissions/content-types/user/lifecycles';
import portfolioLifecycles from './api/portfolio/content-types/portfolio/lifecycles';
import shopLifecycles from './api/shop/content-types/shop/lifecycles';
import artistLifecycles from './api/artist/content-types/artist/lifecycles';
import tripLifecycles from './api/trip/content-types/trip/lifecycles';
import guestLifecycles from './api/guest/content-types/guest/lifecycles';

export default {
  register({ strapi }) {
    // Register GraphQL extensions
    strapi.plugin('graphql').service('extension').use(grapqlGuards);
    strapi.plugin('graphql').service('extension').use(citiesExtension);
    strapi.plugin('graphql').service('extension').use(shopArtistsExtension);
    strapi.plugin('graphql').service('extension').use(usersPermissionsExtension);

    registerAppleAuthProvider({ strapi });
    
    // Register custom routes using strapi.server.routes
    const customRoutes = authRoutes.routes.map(route => ({
      method: route.method,
      path: `/api${route.path}`,
      handler: async (ctx) => {
        const handlerMethod = route.handler.split('.')[1];
        return authController[handlerMethod](ctx);
      },
      config: route.config || {}
    }));

    strapi.server.routes(customRoutes);
  },

  bootstrap({ strapi }) {
    console.log(process.env);

    // Register lifecycle hooks for users-permissions user model
    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      ...userLifecycles,
    });

    // Register lifecycle hooks for portfolio model
    strapi.db.lifecycles.subscribe({
      models: ['api::portfolio.portfolio'],
      ...portfolioLifecycles,
    });

    // Register lifecycle hooks for shop model
    strapi.db.lifecycles.subscribe({
      models: ['api::shop.shop'],
      ...shopLifecycles,
    });

    // Register lifecycle hooks for artist model
    strapi.db.lifecycles.subscribe({
      models: ['api::artist.artist'],
      ...artistLifecycles,
    });

    // Register lifecycle hooks for trip model
    strapi.db.lifecycles.subscribe({
      models: ['api::trip.trip'],
      ...tripLifecycles,
    });

    // Register lifecycle hooks for guest model
    strapi.db.lifecycles.subscribe({
      models: ['api::guest.guest'],
      ...guestLifecycles,
    });
  },
};
