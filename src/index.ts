import { citiesExtension } from './extensions/graphql/cities';
import { shopArtistsExtension } from './extensions/graphql/shop-artists';
import { usersPermissionsExtension } from './extensions/users-permissions';

export default {
  register({ strapi }) {
    // Register GraphQL extensions
    strapi.plugin('graphql').service('extension').use(citiesExtension);
    strapi.plugin('graphql').service('extension').use(shopArtistsExtension);
    strapi.plugin('graphql').service('extension').use(usersPermissionsExtension);

    // Register custom auth routes for REST API
    const authRoutes = require('./extensions/users-permissions/routes/content-api/auth').default;
    const authController = require('./extensions/users-permissions/controllers/auth').default;
    
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
};