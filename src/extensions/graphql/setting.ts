/**
 * GraphQL extension for setting operations
 */

export const settingExtension = ({ strapi }) => ({
  typeDefs: /* GraphQL */ `
    extend type Setting {
      stripeFeePercent: Float!
      totalFeePercent: Float!
    }
  `,
  resolvers: {
    Query: {
      /**
       * Override setting query to include total fee percent
       */
      async setting(parent, args, context) {
        // Get setting data using query API (for singleType)
        const schema = strapi.contentType('api::setting.setting');
        const setting = await strapi.query('api::setting.setting').findOne({});

        if (!setting) {
          return null;
        }

        // Sanitize output
        const sanitized = await strapi.contentAPI.sanitize.output(setting, schema, {
          auth: context.state.auth,
        });

        // Get total fee percent data
        try {
          const feeData = await strapi.service('api::setting.setting').getTotalFeePercent();
          
          return {
            ...sanitized,
            stripeFeePercent: feeData.stripeFeePercent,
            totalFeePercent: feeData.totalFeePercent,
          };
        } catch (error) {
          strapi.log.error('Error getting total fee percent:', error);
          // Return setting without fee data if error occurs
          return sanitized;
        }
      },
    },
  },
  resolversConfig: {
    'Query.setting': { auth: false },
  },
});

