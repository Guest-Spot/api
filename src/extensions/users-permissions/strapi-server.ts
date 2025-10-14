import authController from './controllers/auth';
import authRoutes from './routes/content-api/auth';

type ContentApiRoute = {
  method: string;
  path: string;
  handler: string;
  config?: Record<string, unknown>;
};

export default (plugin: any) => {
  const originalAuthController = plugin.controllers.auth;

  plugin.controllers.auth = (...args: any[]) => {
    const resolvedOriginal =
      typeof originalAuthController === 'function'
        ? originalAuthController(...args)
        : originalAuthController;

    const resolvedCustom =
      typeof authController === 'function' ? authController(...args) : authController;

    return {
      ...resolvedOriginal,
      ...resolvedCustom,
    };
  };

  const existingRoutes: ContentApiRoute[] = plugin.routes['content-api'].routes ?? [];

  const newRoutes = (authRoutes.routes as ContentApiRoute[]).filter((route) => {
    return !existingRoutes.some(
      (existingRoute) =>
        existingRoute.method === route.method && existingRoute.path === route.path
    );
  });

  if (newRoutes.length > 0) {
    plugin.routes['content-api'].routes = [...existingRoutes, ...newRoutes];
  }

  return plugin;
};
