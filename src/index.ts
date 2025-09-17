import { citiesExtension } from './extensions/graphql/cities';
import { shopArtistsExtension } from './extensions/graphql/shop-artists';
import { usersPermissionsExtension } from './extensions/users-permissions';
import authRoutes from './extensions/users-permissions/routes/content-api/auth';
import authController from './extensions/users-permissions/controllers/auth';
import userLifecycles from './extensions/users-permissions/content-types/user/lifecycles';

export default {
  register({ strapi }) {
    // Register GraphQL extensions
    strapi.plugin('graphql').service('extension').use(citiesExtension);
    strapi.plugin('graphql').service('extension').use(shopArtistsExtension);
    strapi.plugin('graphql').service('extension').use(usersPermissionsExtension);
    
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
    // Register lifecycle hooks for users-permissions user model
    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      ...userLifecycles,
    });
  },
};