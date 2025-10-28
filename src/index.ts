import { citiesExtension } from './extensions/graphql/cities';
import { userEmailExistsExtension } from './extensions/graphql/user-email-exists';
import { grapqlGuards } from './extensions/graphql/guards';
import { paymentExtension } from './extensions/graphql/payment';
import { stripeConnectExtension } from './extensions/graphql/stripe-connect';
import { usersPermissionsExtension } from './extensions/users-permissions';

import portfolioLifecycles from './api/portfolio/content-types/portfolio/lifecycles';
import tripLifecycles from './api/trip/content-types/trip/lifecycles';
import { cancelExpiredAuthorizations } from './utils/payment-cron';

export default {
  register({ strapi }) {
    // Register GraphQL extensions
    strapi.plugin('graphql').service('extension').use(grapqlGuards);
    strapi.plugin('graphql').service('extension').use(citiesExtension);
    strapi.plugin('graphql').service('extension').use(userEmailExistsExtension);
    strapi.plugin('graphql').service('extension').use(paymentExtension);
    strapi.plugin('graphql').service('extension').use(stripeConnectExtension);
    strapi.plugin('graphql').service('extension').use(usersPermissionsExtension);
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

    // Start payment authorization expiration cron job
    // Runs every hour to check for expired authorizations
    const cronTask = strapi.cron.add({
      cancelExpiredAuthorizations: {
        task: async ({ strapi }) => {
          await cancelExpiredAuthorizations(strapi);
        },
        options: {
          rule: '0 * * * *', // Every hour at minute 0
        },
      },
    });
  },
};
