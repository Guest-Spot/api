import { citiesExtension } from './extensions/graphql/cities';
import { grapqlGuards } from './extensions/graphql/guards';
import { userChildsExtension } from './extensions/graphql/user-childs';
import { usersPermissionsExtension } from './extensions/users-permissions';
import { registerAppleAuthProvider } from './extensions/users-permissions/providers/apple';

import authRoutes from './extensions/users-permissions/routes/content-api/auth';
import authController from './extensions/users-permissions/controllers/auth';

import portfolioLifecycles from './api/portfolio/content-types/portfolio/lifecycles';
import tripLifecycles from './api/trip/content-types/trip/lifecycles';

export default {
  register({ strapi }) {
    // Register GraphQL extensions
    strapi.plugin('graphql').service('extension').use(grapqlGuards);
    strapi.plugin('graphql').service('extension').use(citiesExtension);
    strapi.plugin('graphql').service('extension').use(usersPermissionsExtension);
    strapi.plugin('graphql').service('extension').use(userChildsExtension);

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

    // Register lifecycle hooks for portfolio model
    strapi.db.lifecycles.subscribe({
      models: ['api::portfolio.portfolio'],
      ...portfolioLifecycles,
    });

    // Register lifecycle hooks for trip model
    strapi.db.lifecycles.subscribe({
      models: ['api::trip.trip'],
      ...tripLifecycles,
    });
  },
};
