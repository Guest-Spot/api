import uploadController from './controllers/upload';
import uploadRoutes from './routes/content-api/upload';

type ContentApiRoute = {
  method: string;
  path: string;
  handler: string;
  config?: Record<string, unknown>;
};

export default (plugin: any) => {
  const originalUploadController = plugin.controllers.upload;

  // Extend upload controller
  plugin.controllers.upload = (...args: any[]) => {
    const resolvedOriginal =
      typeof originalUploadController === 'function'
        ? originalUploadController(...args)
        : originalUploadController;

    // uploadController is an object, not a function
    const resolvedCustom = uploadController;

    return {
      ...resolvedOriginal,
      ...resolvedCustom,
    };
  };

  // Add custom routes
  const existingRoutes: ContentApiRoute[] = plugin.routes['content-api']?.routes ?? [];

  const newRoutes = (uploadRoutes.routes as ContentApiRoute[]).filter((route) => {
    return !existingRoutes.some(
      (existingRoute) =>
        existingRoute.method === route.method && existingRoute.path === route.path
    );
  });

  if (newRoutes.length > 0) {
    if (!plugin.routes['content-api']) {
      plugin.routes['content-api'] = { routes: [] };
    }
    plugin.routes['content-api'].routes = [...existingRoutes, ...newRoutes];
  }

  return plugin;
};

