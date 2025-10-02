import { PLUGIN_ID } from './pluginId';
import { Initializer } from './components/Initializer';
import { PluginIcon } from './components/PluginIcon';
import TemplatePicker from './components/TemplatePicker';
import React from 'react';


export default {
  register(app: any) {
    const apis = app.getPlugin('content-manager').apis;

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: PLUGIN_ID,
      },
      Component: async () => {
        const { App } = await import('./pages/App');

        return App;
      },
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });

    apis.addBulkAction([
      ({ documents }: { documents: any }) => {
        return {
          label: 'Send Email',
          disabled: documents.length === 0,
          dialog: {
            type: 'modal',
            title: 'Send email to selected',
            content: ({ onClose }: { onClose: () => void }) =>
              React.createElement(TemplatePicker, { onClose, documents })
          },
        };
      },
    ]);
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);

          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};
