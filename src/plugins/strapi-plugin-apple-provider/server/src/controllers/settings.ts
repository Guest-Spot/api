import type { Core } from '@strapi/strapi';

type ServiceFactory = typeof import('../services/service').default;
type SettingsService = ReturnType<ServiceFactory>;

const settingsController = ({ strapi }: { strapi: Core.Strapi }) => {
  const getService = () =>
    strapi.plugin('strapi-plugin-apple-provider').service('service') as SettingsService;

  return {
    async find(ctx: Core.KoaContext) {
      try {
        const settings = await getService().getSettings();
        ctx.body = settings;
      } catch (error) {
        strapi.log.error(error);
        ctx.throw(500, 'Failed to load settings.');
      }
    },

    async update(ctx: Core.KoaContext) {
      const { redirectUrl } = ctx.request.body ?? {};
      const authKey = ctx.request.files?.authKey;

      try {
        const updatedSettings = await getService().updateSettings({
          redirectUrl,
          authKey,
        });

        ctx.body = updatedSettings;
      } catch (error: any) {
        const status = typeof error?.status === 'number' ? error.status : 500;
        if (status >= 500) {
          strapi.log.error(error);
        }
        ctx.throw(status, error?.message ?? 'Failed to update settings.');
      }
    },
  };
};

export default settingsController;
